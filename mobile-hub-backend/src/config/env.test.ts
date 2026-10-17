import test from 'node:test';
import assert from 'node:assert/strict';
import { loadEnv } from './env';

const required = {
  PLATFORM_MONGO_URI: 'mongodb://127.0.0.1:27017/test',
  JWT_SECRET: 's'.repeat(40),
  EMAIL_FROM: 'Mobile Inventory <noreply@example.com>'
};

const smtp = {
  SMTP_HOST: 'smtp.gmail.com',
  SMTP_PORT: '587',
  SMTP_USER: 'sender@example.com',
  SMTP_PASSWORD: 'app-password'
};

test('production environment requires SMTP and HTTPS origins', () => {
  assert.throws(() => loadEnv({
    ...required,
    NODE_ENV: 'production',
    WEB_ORIGINS: 'https://mobile.example.com'
  }), /SMTP_HOST, SMTP_USER, and SMTP_PASSWORD/);
  assert.throws(() => loadEnv({
    ...required,
    NODE_ENV: 'production',
    ...smtp,
    SMTP_USE_TLS: 'false',
    WEB_ORIGINS: 'https://mobile.example.com'
  }), /SMTP_USE_TLS must be true in production/);
  assert.throws(() => loadEnv({
    ...required,
    NODE_ENV: 'production',
    ...smtp,
    WEB_ORIGINS: 'http://mobile.example.com'
  }), /HTTPS in production/);
  assert.throws(() => loadEnv({
    ...required,
    ...smtp,
    WEB_ORIGINS: '*'
  }), /wildcard/);
  assert.doesNotThrow(() => loadEnv({
    ...required,
    NODE_ENV: 'production',
    ...smtp,
    WEB_ORIGINS: 'https://mobile.example.com'
  }));
});

test('SMTP port and TLS settings are parsed and validated', () => {
  assert.equal(loadEnv({
    ...required,
    SMTP_PORT: '465',
    SMTP_USE_TLS: 'false'
  }).SMTP_PORT, 465);
  assert.equal(loadEnv({
    ...required,
    SMTP_USE_TLS: 'false'
  }).SMTP_USE_TLS, false);
  assert.throws(() => loadEnv({ ...required, SMTP_PORT: '70000' }), /SMTP_PORT/);
  assert.throws(() => loadEnv({ ...required, SMTP_USE_TLS: 'sometimes' }), /SMTP_USE_TLS/);
});
