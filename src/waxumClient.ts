export class WaxumApiError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string) {
    super(`waxum API error ${status}: ${body}`);
    this.name = 'WaxumApiError';
    this.status = status;
    this.body = body;
  }
}

export interface SendTextResult {
  message_id: string;
  timestamp: number;
  to: string;
  status?: string;
}

/** Minimal client for the one waxum endpoint this channel needs: sending a reply. */
export class WaxumClient {
  private readonly baseUrl: string;
  private readonly token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.token = token;
  }

  async sendText(
    sessionId: string,
    body: { to: string; text: string; reply_to?: string },
  ): Promise<SendTextResult> {
    const res = await fetch(`${this.baseUrl}/api/v1/sessions/${sessionId}/messages/text`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new WaxumApiError(res.status, text);
    }
    return text ? (JSON.parse(text) as SendTextResult) : ({} as SendTextResult);
  }
}
