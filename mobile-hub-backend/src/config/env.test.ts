import test from 'node:test';
import assert from 'node:assert/strict';
import { loadEnv } from './env';

const required = {
  PLATFORM_MONGO_URI: 'mongodb://127.0.0.1:27017/test',
  JWT_SECRET: 's'.repeat(40),
  EMAIL_FROM: 'Mobile Inventory <noreply@example.com>'
};

test('production environment requires Resend and HTTPS origins', () => {
  assert.throws(() => loadEnv({
    ...required,
    NODE_ENV: 'production',
    WEB_ORIGINS: 'https://mobile.example.com'
  }), /RESEND_API_KEY/);
  assert.throws(() => loadEnv({
    ...required,
    NODE_ENV: 'production',
    RESEND_API_KEY: 're_test',
    WEB_ORIGINS: 'http://mobile.example.com'
  }), /HTTPS in production/);
  assert.throws(() => loadEnv({
    ...required,
    RESEND_API_KEY: 're_test',
    WEB_ORIGINS: '*'
  }), /wildcard/);
  assert.doesNotThrow(() => loadEnv({
    ...required,
    NODE_ENV: 'production',
    RESEND_API_KEY: 're_test',
    WEB_ORIGINS: 'https://mobile.example.com'
  }));
});
