import test from 'node:test';
import assert from 'node:assert/strict';
import { Tenant } from './Tenant';
import { User } from './User';
import { TenantMembership } from './TenantMembership';
import { Plan } from './Plan';
import { Subscription } from './Subscription';
import { AuditLog } from './AuditLog';
import { DomainMapping } from './DomainMapping';
import { Product } from './Product';

test('platform tenant, identity, billing, audit, and domain schemas enforce core indexes', () => {
  assert.ok(Tenant.schema.indexes().some(([keys, options]) => keys.slug === 1 && options.unique === true));
  assert.ok(User.schema.indexes().some(([keys, options]) => keys.email === 1 && options.unique === true));
  assert.ok(TenantMembership.schema.indexes().some(([keys, options]) =>
    keys.tenantId === 1 && keys.userId === 1 && options.unique === true
  ));
  assert.ok(Plan.schema.indexes().some(([keys, options]) => keys.code === 1 && options.unique === true));
  assert.ok(Subscription.schema.path('billingInterval'));
  assert.ok(AuditLog.schema.path('actorUserId'));
  assert.ok(DomainMapping.schema.indexes().some(([keys, options]) =>
    keys.hostname === 1 && options.unique === true
  ));
  assert.ok(Product.schema.indexes().some(([keys, options]) =>
    keys.tenantId === 1 && keys.sku === 1 && options.unique === true
  ));
});

test('tenant JSON and user schema do not expose database secrets or password hashes', () => {
  const tenant = new Tenant({
    name: 'Example Shop',
    slug: 'example-shop',
    ownerUserId: '64b000000000000000000001',
    storage: {
      mode: 'byod',
      encryptedUri: 'ciphertext',
      keyVersion: 'key-v1'
    }
  });
  const json = tenant.toJSON() as { storage: Record<string, unknown> };
  assert.equal(json.storage.encryptedUri, undefined);
  assert.equal(json.storage.keyVersion, undefined);
  assert.equal(User.schema.path('passwordHash').options.select, false);
  assert.equal(DomainMapping.schema.path('verificationTokenHash').options.select, false);
  assert.equal(Product.schema.path('tenantId').options.immutable, true);
  assert.equal(Product.schema.path('sellingPriceMinor').options.validate, Number.isSafeInteger);
});
