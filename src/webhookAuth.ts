import { createHmac, timingSafeEqual } from 'node:crypto';

/** Deliveries older than this are rejected even with a valid signature -- caps
 * how long a captured `(timestamp, signature, body)` tuple stays replayable. */
const MAX_CLOCK_SKEW_SECONDS = 5 * 60;

/**
 * Verifies a waxum webhook delivery per the v2 signing scheme
 * (`X-Webhook-Signature-Version: v2`): HMAC-SHA256 over `{timestamp}.{rawBody}`
 * keyed by the webhook secret, timestamp bound in to prevent indefinite replay
 * of a captured payload. See waxum's docs/api/webhooks.md for the receiver
 * recipe this mirrors.
 */
export function verifyWaxumWebhook(
  secret: string,
  rawBody: string,
  timestampHeader: string | undefined,
  signatureHeader: string | undefined,
): { ok: true } | { ok: false; reason: string } {
  if (!timestampHeader) {
    return { ok: false, reason: 'missing X-Webhook-Timestamp' };
  }
  if (!signatureHeader) {
    return { ok: false, reason: 'missing X-Webhook-Signature' };
  }

  const timestamp = Number(timestampHeader);
  if (!Number.isFinite(timestamp)) {
    return { ok: false, reason: 'non-numeric X-Webhook-Timestamp' };
  }
  const skew = Math.abs(Date.now() / 1000 - timestamp);
  if (skew > MAX_CLOCK_SKEW_SECONDS) {
    return { ok: false, reason: `timestamp outside ${MAX_CLOCK_SKEW_SECONDS}s window (skew ${skew}s)` };
  }

  const expected = createHmac('sha256', secret)
    .update(`${timestampHeader}.${rawBody}`)
    .digest('hex');
  const expectedHeader = `sha256=${expected}`;

  const a = Buffer.from(expectedHeader);
  const b = Buffer.from(signatureHeader);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: 'signature mismatch' };
  }

  return { ok: true };
}
