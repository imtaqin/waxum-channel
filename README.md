# waxum-channel

A Claude Code [channel](https://code.claude.com/docs/en/channels) that
bridges WhatsApp (via the [waxum](https://github.com/imtaqin/waxum) REST
gateway) into a running Claude Code session — message someone on WhatsApp,
Claude reads it as context and can reply back through the same chat.

This is a different thing from [`waxum-mcp`](https://github.com/imtaqin/waxum-mcp):
`waxum-mcp` gives Claude *tools* to call WhatsApp on its own. `waxum-channel`
does the opposite direction — it lets *WhatsApp messages* reach into a
running Claude Code session as events, the way `@Claude` in Slack does,
except self-hosted and WhatsApp-specific. You can run both at once.

Channels are a Claude Code **research preview** feature (as of this
writing). Custom channels aren't on the approved allowlist yet, so you run
this with `--dangerously-load-development-channels` — see [Usage](#usage).

## How it works

```
WhatsApp message → waxum → HMAC-signed webhook → waxum-channel → Claude Code session
                                                                        ↓
WhatsApp reply    ← waxum ←  POST /messages/text  ← reply tool  ← Claude Code session
```

1. You register a waxum webhook (`POST /sessions/{id}/webhooks`) pointing at
   this server's `/` endpoint, subscribed to the `message` event, with a
   secret.
2. waxum HMAC-signs every delivery with that secret. This server verifies
   the signature and timestamp before doing anything else — an unsigned or
   forged request never reaches Claude. See waxum's
   [webhook docs](https://waxum.imtaqin.id/docs/api/webhooks) for the
   signing scheme this implements (`X-Webhook-Signature-Version: v2`).
3. Inbound messages are also gated on an **allowlist of senders** (phone
   numbers/JIDs), checked against the actual sender — never the chat/group
   id — since gating on the room would let anyone in an allowlisted group
   inject messages into your session. This is on top of the signature
   check, not instead of it.
4. A matching message is forwarded into your Claude Code session as a
   `<channel>` event. Claude can reply through the `reply` tool this server
   exposes, which calls waxum's `POST /messages/text`.

## Setup

### 1. Build

```bash
npm install
npm run build
```

### 2. Expose this server to waxum

waxum needs to reach this server's HTTP port (default `8790`) to deliver
webhooks. If waxum runs on a different machine (a VPS, for example, as
opposed to localhost), put a tunnel in front — a
[Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
or `ngrok http 8790` both work. If waxum runs on the same host, a plain
`http://127.0.0.1:8790` webhook URL is enough.

### 3. Register the waxum webhook

```bash
curl -X POST "$WAXUM_BASE_URL/api/v1/sessions/$SESSION_ID/webhooks" \
  -H "Authorization: Bearer $WAXUM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-tunnel-or-host/",
    "events": ["message"],
    "secret": "<a random secret — this is WAXUM_CHANNEL_WEBHOOK_SECRET below>"
  }'
```

### 4. Configure the environment

| Variable | Required | Description |
|---|---|---|
| `WAXUM_BASE_URL` | Yes | waxum's base URL, e.g. `https://waxum-api.example.com` |
| `WAXUM_TOKEN` | Yes | Bearer token for waxum (superadmin or session-scoped) |
| `WAXUM_SESSION_ID` | Yes | The waxum session to send replies through |
| `WAXUM_CHANNEL_WEBHOOK_SECRET` | Yes | Same secret used when registering the webhook (step 3) |
| `WAXUM_CHANNEL_ALLOWED_SENDERS` | Yes | Comma-separated phone numbers/JIDs allowed to reach Claude. No default — an ungated channel is a prompt-injection vector. |
| `WAXUM_CHANNEL_PORT` | No | Local HTTP port (default `8790`) |
| `WAXUM_CHANNEL_ALLOW_GROUPS` | No | `true` to forward group messages too (still sender-gated). Default off — most groups are too noisy to page Claude on every message. |

### 5. Register with Claude Code

```json title=".mcp.json"
{
  "mcpServers": {
    "waxum-channel": {
      "command": "node",
      "args": ["/absolute/path/to/waxum-channel/dist/index.js"],
      "env": {
        "WAXUM_BASE_URL": "https://waxum-api.example.com",
        "WAXUM_TOKEN": "...",
        "WAXUM_SESSION_ID": "...",
        "WAXUM_CHANNEL_WEBHOOK_SECRET": "...",
        "WAXUM_CHANNEL_ALLOWED_SENDERS": "6281234567890"
      }
    }
  }
}
```

## Usage

```bash
claude --dangerously-load-development-channels server:waxum-channel
```

Claude Code shows a one-time confirmation dialog for the development-channel
flag and, separately, for trusting the new MCP server on first use in a
project. After both, message the WhatsApp number tied to `WAXUM_SESSION_ID`
from an allowlisted number — the message shows up in your session as a
`<channel source="waxum-channel" ...>` event, and Claude can reply with the
`reply` tool.

### Approving tool use from WhatsApp

This channel relays permission prompts (`Bash`, `Write`, `Edit`, ...) to
every allowlisted sender in parallel with the local terminal dialog. When
Claude wants to run something that needs approval, each allowlisted number
gets a WhatsApp message like:

```
🔐 Claude wants to run Bash: list files in the project
ls -la

Reply "yes abcde" or "no abcde"
```

Reply `yes abcde` or `no abcde` (case-insensitive) from any allowlisted
number to approve or deny. Whichever side answers first — the terminal or
WhatsApp — wins; the other is dropped. A reply that doesn't match the
`yes/no <id>` format, or carries an id Claude Code didn't just issue, falls
through as a normal chat message instead.

## Security notes

- **Two independent gates, both required**: HMAC signature verification
  (proves the request actually came from your waxum instance) and sender
  allowlisting (proves the *WhatsApp message* actually came from someone you
  trust). Neither substitutes for the other — a compromised or misrouted
  webhook secret without sender gating would let anyone message your bot and
  have it treated as trusted input; sender gating without signature
  verification would let anyone who finds the URL forge a message that
  claims to be from an allowlisted number.
- Treat the message **text** as untrusted even from an allowlisted sender —
  it's still free-form input from outside your session, same as any other
  external content.
- **Permission relay is on** for every allowlisted sender (see above) — this
  means anyone who can message an allowlisted number's own phone (or anyone
  who controls that number) can approve or deny tool use in your session.
  Only allowlist numbers you'd trust with that. There's no separate,
  narrower "read-only" allowlist tier.

## Development

```bash
npm install
npm run dev       # run directly with tsx
npm run build     # compile to dist/
npm run typecheck
```
