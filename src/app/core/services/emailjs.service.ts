import { inject, Injectable } from '@angular/core';
import { ENVIRONMENT } from '../tokens/environment.token';
import emailjs from '@emailjs/browser';

export interface EmailPayload {
  name: string;
  email: string;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class EmailjsService {
  private readonly env = inject(ENVIRONMENT);

  private get hasValidConfig(): boolean {
    return Boolean(
      this.env.emailjsServiceId.trim() &&
      this.env.emailjsTemplateId.trim() &&
      this.env.emailjsPublicKey.trim(),
    );
  }

  async send(payload: EmailPayload): Promise<void> {
    if (!this.hasValidConfig) {
      throw new Error('EmailJS is not configured. Set EmailJS environment variables.');
    }

    await emailjs.send(
      this.env.emailjsServiceId,
      this.env.emailjsTemplateId,
      {
        from_name: payload.name,
        from_email: payload.email,
        email: payload.email,
        reply_to: payload.email,
        message: payload.message,
      },
      { publicKey: this.env.emailjsPublicKey },
    );
  }
}
