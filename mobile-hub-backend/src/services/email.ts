import nodemailer from 'nodemailer';
import type { AppEnv } from '../config/env';

export interface VerificationMailer {
  sendVerificationEmail(email: string, name: string, token: string): Promise<void>;
}

interface VerificationMessage {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}

interface SmtpTransport {
  sendMail(message: VerificationMessage): Promise<unknown>;
}

interface SmtpTransportOptions {
  host: string;
  port: number;
  secure: boolean;
  requireTLS: boolean;
  auth: { user: string; pass: string };
  connectionTimeout: number;
  greetingTimeout: number;
  socketTimeout: number;
}

type SmtpTransportFactory = (options: SmtpTransportOptions) => SmtpTransport;

export class SmtpVerificationMailer implements VerificationMailer {
  constructor(
    private readonly env: AppEnv,
    private readonly createTransport: SmtpTransportFactory = options => nodemailer.createTransport(options)
  ) {}

  async sendVerificationEmail(email: string, name: string, token: string): Promise<void> {
    if (!this.env.SMTP_HOST || !this.env.SMTP_USER || !this.env.SMTP_PASSWORD) {
      throw new Error('SMTP_HOST, SMTP_USER, and SMTP_PASSWORD are required to send email.');
    }
    const origin = this.env.WEB_ORIGINS.split(',')[0]?.trim();
    if (!origin) throw new Error('WEB_ORIGINS must contain a frontend origin.');
    const verificationUrl = new URL('/verify-email', origin);
    verificationUrl.searchParams.set('token', token);

    const port = this.env.SMTP_PORT;
    const transport = this.createTransport({
      host: this.env.SMTP_HOST,
      port,
      secure: port === 465,
      requireTLS: this.env.SMTP_USE_TLS && port !== 465,
      auth: { user: this.env.SMTP_USER, pass: this.env.SMTP_PASSWORD },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000
    });
    await transport.sendMail({
      from: this.env.SMTP_FROM || this.env.EMAIL_FROM,
      to: email,
      subject: 'Verify your Mobile Inventory account',
      text: `Hello ${name}, verify your email to continue your shop application: ${verificationUrl.toString()}`,
      html: `<p>Hello ${escapeHtml(name)},</p><p><a href="${escapeHtml(verificationUrl.toString())}">Verify your email</a> to continue your shop application.</p>`
    });
  }
}

const escapeHtml = (value: string): string => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');
