import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { createProductFilter } from './inventory';

test('inventory filters combine item type and hide-zero-quantity with tenant scope', () => {
  const tenantId = new mongoose.Types.ObjectId();
  const filter = createProductFilter(tenantId, {
    search: 'phone',
    category: undefined,
    itemType: 'Phone',
    hideZeroQuantity: true,
    includeArchived: false,
    posOnly: false
  });

  assert.equal(filter.tenantId, tenantId);
  assert.equal(filter.status, 'active');
  assert.equal(filter.itemType, 'Phone');
  assert.deepEqual(filter.quantityOnHand, { $gt: 0 });
  assert.ok(Array.isArray(filter.$or));
});

test('inventory filters retain zero stock when hide-zero-quantity is disabled', () => {
  const filter = createProductFilter(new mongoose.Types.ObjectId(), {
    search: undefined,
    category: undefined,
    itemType: undefined,
    hideZeroQuantity: false,
    includeArchived: false,
    posOnly: false
  });

  assert.equal(filter.quantityOnHand, undefined);
});
