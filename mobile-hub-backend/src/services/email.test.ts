import test from 'node:test';
import assert from 'node:assert/strict';
import { loadEnv } from '../config/env';
import { SmtpVerificationMailer } from './email';

const env = loadEnv({
  NODE_ENV: 'test',
  PLATFORM_MONGO_URI: 'mongodb://127.0.0.1:27017/test',
  JWT_SECRET: 'x'.repeat(40),
  WEB_ORIGINS: 'https://mobile.example.com',
  EMAIL_FROM: 'Mobile Inventory <sender@example.com>',
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: '587',
  SMTP_USER: 'sender@example.com',
  SMTP_PASSWORD: 'smtp-test-password'
});

type CapturedTransportOptions = {
  host: string;
  port: number;
  secure: boolean;
  requireTLS: boolean;
  auth: { user: string; pass: string };
};

test('SMTP verification email uses STARTTLS and safely renders the recipient name', async () => {
  let transportOptions: CapturedTransportOptions | undefined;
  let sentMessage: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html: string;
  } | undefined;
  const mailer = new SmtpVerificationMailer(env, options => {
    transportOptions = options;
    return {
      async sendMail(message) {
        sentMessage = message;
      }
    };
  });

  await mailer.sendVerificationEmail('owner@example.com', '<Shop & Co>', 'verification-token');

  assert.equal(transportOptions?.host, 'smtp.example.com');
  assert.equal(transportOptions?.port, 587);
  assert.equal(transportOptions?.secure, false);
  assert.equal(transportOptions?.requireTLS, true);
  assert.equal(transportOptions?.auth.user, 'sender@example.com');
  assert.equal(sentMessage?.from, 'Mobile Inventory <sender@example.com>');
  assert.equal(sentMessage?.to, 'owner@example.com');
  assert.match(sentMessage?.text || '', /https:\/\/mobile\.example\.com\/verify-email\?token=verification-token/);
  assert.match(sentMessage?.html || '', /&lt;Shop &amp; Co&gt;/);
});

test('SMTP verification email uses implicit TLS on port 465 and supports an explicit sender', async () => {
  let transportOptions: CapturedTransportOptions | undefined;
  let sender: string | undefined;
  const mailer = new SmtpVerificationMailer(loadEnv({
    NODE_ENV: 'test',
    PLATFORM_MONGO_URI: 'mongodb://127.0.0.1:27017/test',
    JWT_SECRET: 'x'.repeat(40),
    WEB_ORIGINS: 'https://mobile.example.com',
    EMAIL_FROM: 'Mobile Inventory <sender@example.com>',
    SMTP_HOST: 'smtp.example.com',
    SMTP_PORT: '465',
    SMTP_USER: 'sender@example.com',
    SMTP_PASSWORD: 'smtp-test-password',
    SMTP_FROM: 'Mobile Inventory Notifications <notifications@example.com>'
  }), options => {
    transportOptions = options;
    return {
      async sendMail(message) {
        sender = message.from;
      }
    };
  });

  await mailer.sendVerificationEmail('owner@example.com', 'Shop Owner', 'token');

  assert.equal(transportOptions?.secure, true);
  assert.equal(transportOptions?.requireTLS, false);
  assert.equal(sender, 'Mobile Inventory Notifications <notifications@example.com>');
});

test('SMTP verification email reports incomplete server configuration', async () => {
  const mailer = new SmtpVerificationMailer(loadEnv({
    NODE_ENV: 'test',
    PLATFORM_MONGO_URI: 'mongodb://127.0.0.1:27017/test',
    JWT_SECRET: 'x'.repeat(40),
    WEB_ORIGINS: 'https://mobile.example.com',
    EMAIL_FROM: 'Mobile Inventory <sender@example.com>'
  }));

  await assert.rejects(
    mailer.sendVerificationEmail('owner@example.com', 'Shop Owner', 'token'),
    /SMTP_HOST, SMTP_USER, and SMTP_PASSWORD/
  );
});
