function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required but not set`);
  }
  return value;
}

export interface Config {
  baseUrl: string;
  token: string;
  sessionId: string;
  /** Local port the webhook HTTP listener binds. waxum must be able to
   * reach it -- put a reverse proxy / tunnel in front if waxum runs
   * somewhere other than localhost. */
  port: number;
  /** Shared secret configured on the waxum webhook this channel expects
   * deliveries from. Required -- an unsigned webhook endpoint is a
   * prompt-injection vector reachable by anyone who finds the URL. */
  webhookSecret: string;
  /**
   * Bare phone numbers or JIDs allowed to reach Claude through this
   * channel, comma-separated. Gated on the message's actual sender
   * (`from_phone`/`from`), never the chat/group id -- per the channel
   * contract, gating on the room would let anyone in an allowlisted
   * group inject messages. Required: an ungated channel is a prompt
   * injection vector, and WhatsApp has no separate "pairing" concept
   * to bootstrap the list the way Telegram/Discord channels do.
   */
  allowedSenders: Set<string>;
  /**
   * When true, group messages are forwarded too (still gated on
   * sender). Off by default -- most WhatsApp groups are noisy and not
   * meant to page Claude on every message.
   */
  allowGroups: boolean;
}

function normalizeSender(raw: string): string {
  return raw.trim().replace(/^\+/, '').replace(/@.*$/, '');
}

export function loadConfig(): Config {
  const allowedSenders = new Set(
    required('WAXUM_CHANNEL_ALLOWED_SENDERS')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map(normalizeSender),
  );
  if (allowedSenders.size === 0) {
    throw new Error('WAXUM_CHANNEL_ALLOWED_SENDERS must list at least one phone number or JID');
  }

  return {
    baseUrl: required('WAXUM_BASE_URL').replace(/\/+$/, ''),
    token: required('WAXUM_TOKEN'),
    sessionId: required('WAXUM_SESSION_ID'),
    port: Number(process.env.WAXUM_CHANNEL_PORT ?? 8790),
    webhookSecret: required('WAXUM_CHANNEL_WEBHOOK_SECRET'),
    allowedSenders,
    allowGroups: process.env.WAXUM_CHANNEL_ALLOW_GROUPS === 'true',
  };
}

export { normalizeSender };
