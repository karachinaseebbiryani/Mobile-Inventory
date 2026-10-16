import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from './app';
import { loadEnv } from './config/env';
import type { RegistrationStore } from './services/signup';
import type { VerificationMailer } from './services/email';

test('register endpoint validates input and creates an application without disclosing a token', async () => {
  let saved = false;
  let emailed = false;
  const registrationStore: RegistrationStore = {
    async createPendingApplication() {
      saved = true;
    }
  };
  const mailer: VerificationMailer = {
    async sendVerificationEmail() {
      emailed = true;
    }
  };
  const env = loadEnv({
    NODE_ENV: 'test',
    PLATFORM_MONGO_URI: 'mongodb://127.0.0.1:27017/test',
    JWT_SECRET: 'x'.repeat(40),
    WEB_ORIGINS: 'http://localhost:3000',
    EMAIL_FROM: 'Mobile Inventory <noreply@example.com>'
  });
  const server = http.createServer(createApp(env, { mailer, registrationStore }));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));

  try {
    const address = server.address() as AddressInfo;
    const origin = `http://127.0.0.1:${address.port}`;
    const invalid = await fetch(`${origin}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug: 'admin' })
    });
    assert.equal(invalid.status, 400);
    assert.equal(saved, false);

    const response = await fetch(`${origin}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        shopName: 'Example Mobile',
        slug: 'abc',
        ownerName: 'Shop Owner',
        email: 'owner@example.com',
        password: 'Strong-example-password-123',
        phone: ''
      })
    });
    const body = await response.json() as Record<string, unknown>;
    assert.equal(response.status, 202);
    assert.equal(saved, true);
    assert.equal(emailed, true);
    assert.equal('accessToken' in body, false);
    assert.match(String(body.message), /super administrator must approve/i);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
