import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import {
  prepareApplicationApproval,
  registerOwner,
  type RegisterInput,
  type RegistrationStore
} from './signup';
import type { VerificationMailer } from './email';

test('registration stores pending applicant data with password and verification token hashes', async () => {
  let saved: Parameters<RegistrationStore['createPendingApplication']>[0] | undefined;
  let sent: { email: string; name: string; token: string } | undefined;
  const store: RegistrationStore = {
    async createPendingApplication(data) {
      saved = data;
    }
  };
  const mailer: VerificationMailer = {
    async sendVerificationEmail(email, name, token) {
      sent = { email, name, token };
    }
  };
  const input: RegisterInput = {
    shopName: 'Example Mobile',
    slug: 'example-mobile',
    ownerName: 'Shop Owner',
    email: 'owner@example.com',
    password: 'Strong-example-password-123',
    phone: '+441234567890'
  };

  await registerOwner(input, store, mailer, new Date('2026-01-01T00:00:00.000Z'));
  assert.ok(saved);
  assert.ok(sent);
  assert.equal(saved.input.email, input.email);
  assert.notEqual(saved.passwordHash, input.password);
  assert.equal(await bcrypt.compare(input.password, saved.passwordHash), true);
  assert.notEqual(saved.verificationTokenHash, sent.token);
  assert.equal(saved.verificationExpiresAt.toISOString(), '2026-01-02T00:00:00.000Z');
});

test('failed verification email delivery is surfaced after application persistence', async () => {
  let persisted = false;
  const store: RegistrationStore = {
    async createPendingApplication() {
      persisted = true;
    }
  };
  const mailer: VerificationMailer = {
    async sendVerificationEmail() {
      throw new Error('mail provider unavailable');
    }
  };

  await assert.rejects(
    registerOwner({
      shopName: 'Example Mobile',
      slug: 'example-mobile',
      ownerName: 'Shop Owner',
      email: 'owner@example.com',
      password: 'Strong-example-password-123',
      phone: ''
    }, store, mailer),
    /verification email delivery failed/i
  );
  assert.equal(persisted, true);
});

test('approval activates membership and creates a bounded trial only after email verification', () => {
  const transition = prepareApplicationApproval({
    applicationStatus: 'pending',
    tenantStatus: 'pending',
    ownerEmailVerified: true,
    planActive: true,
    trialDays: 14,
    now: new Date('2026-01-01T00:00:00.000Z')
  });
  assert.equal(transition.tenantStatus, 'active');
  assert.equal(transition.membershipStatus, 'active');
  assert.equal(transition.subscriptionStatus, 'trialing');
  assert.equal(transition.periodEnd?.toISOString(), '2026-01-15T00:00:00.000Z');

  assert.throws(() => prepareApplicationApproval({
    applicationStatus: 'pending',
    tenantStatus: 'pending',
    ownerEmailVerified: false,
    planActive: true,
    trialDays: 14
  }), /verify their email/i);
  assert.throws(() => prepareApplicationApproval({
    applicationStatus: 'approved',
    tenantStatus: 'active',
    ownerEmailVerified: true,
    planActive: true,
    trialDays: 14
  }), /no longer pending/i);
});
