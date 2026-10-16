import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveEntitlements } from './entitlements';

test('plan features, add-ons, and explicit tenant overrides follow precedence', () => {
  const result = resolveEntitlements({
    tenantStatus: 'active',
    subscriptionStatus: 'active',
    currentPeriodEnd: new Date('2027-01-01T00:00:00.000Z'),
    planFeatures: { pos: true, inventory: false },
    addOnFeatures: { inventory: true },
    overrides: { pos: false, repairs: true }
  }, new Date('2026-01-01T00:00:00.000Z'));

  assert.equal(result.allowed, true);
  assert.equal(result.features.pos, false);
  assert.equal(result.features.inventory, true);
  assert.equal(result.features.repairs, true);
});

test('inactive tenants and expired or unbounded subscriptions deny all protected access', () => {
  const base = {
    subscriptionStatus: 'active',
    currentPeriodEnd: new Date('2026-02-01T00:00:00.000Z'),
    planFeatures: { pos: true },
    overrides: { pos: true }
  };
  const suspended = resolveEntitlements({
    ...base,
    tenantStatus: 'suspended'
  }, new Date('2026-01-01T00:00:00.000Z'));
  assert.equal(suspended.allowed, false);
  assert.equal(suspended.reason, 'tenant_inactive');

  const expired = resolveEntitlements({
    ...base,
    tenantStatus: 'active',
    currentPeriodEnd: new Date('2025-12-01T00:00:00.000Z')
  }, new Date('2026-01-01T00:00:00.000Z'));
  assert.equal(expired.allowed, false);
  assert.equal(expired.reason, 'subscription_inactive');

  const unbounded = resolveEntitlements({
    ...base,
    tenantStatus: 'active',
    currentPeriodEnd: null
  }, new Date('2026-01-01T00:00:00.000Z'));
  assert.equal(unbounded.allowed, false);
});
