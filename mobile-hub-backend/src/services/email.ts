import type { AppEnv } from '../config/env';

export interface VerificationMailer {
  sendVerificationEmail(email: string, name: string, token: string): Promise<void>;
}

export class ResendVerificationMailer implements VerificationMailer {
  constructor(private readonly env: AppEnv) {}

  async sendVerificationEmail(email: string, name: string, token: string): Promise<void> {
    if (!this.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured.');
    const origin = this.env.WEB_ORIGINS.split(',')[0]?.trim();
    if (!origin) throw new Error('WEB_ORIGINS must contain a frontend origin.');
    const verificationUrl = new URL('/verify-email', origin);
    verificationUrl.searchParams.set('token', token);
    const result = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.env.RESEND_API_KEY}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        from: this.env.EMAIL_FROM,
        to: [email],
        subject: 'Verify your Mobile Inventory account',
        text: `Hello ${name}, verify your email to continue your shop application: ${verificationUrl.toString()}`,
        html: `<p>Hello ${escapeHtml(name)},</p><p><a href="${escapeHtml(verificationUrl.toString())}">Verify your email</a> to continue your shop application.</p>`
      }),
      signal: AbortSignal.timeout(10000)
    });
    if (!result.ok) throw new Error(`Email provider returned HTTP ${result.status}.`);
  }
}

const escapeHtml = (value: string): string => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');
