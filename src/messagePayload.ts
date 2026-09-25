/** Shape of the `data` object on a waxum `message` webhook event.
 * See imtaqin/waxum-doc docs/api/webhooks.md (Message Event). Only the
 * fields this channel actually reads are typed; the rest pass through
 * untouched inside the raw payload. */
export interface WaxumMessageData {
  from: string;
  from_phone: string | null;
  chat: string;
  chat_phone: string | null;
  message_id: string;
  is_from_me: boolean;
  push_name: string | null;
  message_type: string;
  text: string | null;
  caption: string | null;
  is_group: boolean;
  participant: string;
  quoted_message_id: string | null;
  quoted_sender_jid: string | null;
}

export interface WaxumWebhookEnvelope {
  session_id: string;
  event: string;
  timestamp: number;
  offline?: boolean;
  data: WaxumMessageData;
}

export function isMessageEnvelope(value: unknown): value is WaxumWebhookEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return v.event === 'message' && typeof v.data === 'object' && v.data !== null;
}
