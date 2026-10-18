import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import type { AppEnv } from '../config/env';
import { FEATURE_KEYS } from '../config/features';
import { createApp } from '../app';
import { AuditLog } from '../models/AuditLog';
import { DomainMapping } from '../models/DomainMapping';
import { Plan } from '../models/Plan';
import { Product } from '../models/Product';
import { SignupRequest } from '../models/SignupRequest';
import { Subscription } from '../models/Subscription';
import { Tenant } from '../models/Tenant';
import { TenantMembership } from '../models/TenantMembership';
import { User } from '../models/User';
import type { VerificationMailer } from '../services/email';
import { InventoryService } from '../services/inventory';

const testMongoUri = process.env.TEST_MONGO_URI;

test('products remain isolated between tenant contexts through the API', {
  skip: !testMongoUri && 'Set TEST_MONGO_URI to run MongoDB integration tests.'
}, async () => {
  assert.ok(testMongoUri);
  const testDatabase = `mobile_inventory_test_${randomUUID().replace(/-/g, '')}`;
  await mongoose.connect(testMongoUri, { dbName: testDatabase, autoIndex: true });
  let server: http.Server | undefined;

  try {
    const user = await User.create({
      name: 'Integration Owner',
      email: `${randomUUID()}@example.test`,
      passwordHash: 'not-used-by-this-test',
      emailVerifiedAt: new Date()
    });
    const featureSet = Object.fromEntries(FEATURE_KEYS.map(feature => [feature, true]));
    const plan = await Plan.create({
      name: 'Integration',
      code: `integration-${randomUUID().slice(0, 8)}`,
      monthlyPriceMinor: 100,
      yearlyPriceMinor: 1000,
      currency: 'GBP',
      features: featureSet
    });
    const tenantA = await Tenant.create({
      name: 'Tenant A',
      slug: `tenant-a-${randomUUID().slice(0, 8)}`,
      status: 'active',
      ownerUserId: user._id,
      planId: plan._id
    });
    const tenantB = await Tenant.create({
      name: 'Tenant B',
      slug: `tenant-b-${randomUUID().slice(0, 8)}`,
      status: 'active',
      ownerUserId: user._id,
      planId: plan._id
    });
    await TenantMembership.create([
      { tenantId: tenantA._id, userId: user._id, role: 'owner', status: 'active' },
      { tenantId: tenantB._id, userId: user._id, role: 'owner', status: 'active' }
    ]);
    const periodEnd = new Date(Date.now() + 86400000);
    await Subscription.create([
      {
        tenantId: tenantA._id,
        planId: plan._id,
        status: 'active',
        billingInterval: 'month',
        currentPeriodStart: new Date(),
        currentPeriodEnd: periodEnd
      },
      {
        tenantId: tenantB._id,
        planId: plan._id,
        status: 'active',
        billingInterval: 'month',
        currentPeriodStart: new Date(),
        currentPeriodEnd: periodEnd
      }
    ]);
    const foreignProduct = await new InventoryService().create(tenantB._id, user._id, {
      sku: 'OTHER-SHOP-001',
      name: 'Private tenant B stock',
      description: '',
      brand: '',
      model: '',
      category: 'Phones',
      barcode: null,
      costPriceMinor: 10000,
      sellingPriceMinor: 15000,
      currency: 'GBP',
      quantityOnHand: 0,
      reorderLevel: 1
    });
    assert.ok(foreignProduct);

    const secret = 'integration-only-signing-secret-which-is-long-enough';
    const env: AppEnv = {
      NODE_ENV: 'test',
      PORT: 0,
      PLATFORM_MONGO_URI: testMongoUri,
      JWT_SECRET: secret,
      JWT_EXPIRES_IN: '15m',
      WEB_ORIGINS: 'http://localhost:3000',
      EMAIL_FROM: 'Inventory Test <test@example.test>',
      SMTP_HOST: '',
      SMTP_PORT: 587,
      SMTP_USER: '',
      SMTP_PASSWORD: '',
      SMTP_FROM: '',
      SMTP_USE_TLS: true
    };
    const mailer: VerificationMailer = {
      async sendVerificationEmail() {
        throw new Error('Email is not used by this integration test.');
      }
    };
    const token = jwt.sign(
      { platformRole: 'user' },
      secret,
      { subject: String(user._id), expiresIn: '15m' }
    );
    server = http.createServer(createApp(env, { mailer }));
    await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', resolve));
    const address = server.address() as AddressInfo;
    const api = `http://127.0.0.1:${address.port}/api/v1/products`;
    const session = await fetch(`http://127.0.0.1:${address.port}/api/v1/auth/me`, {
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(session.status, 200);
    const sessionBody = await session.json() as { shops: Array<{ id: string }> };
    assert.equal(sessionBody.shops.length, 2);
    const headers = {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json'
    };

    const list = await fetch(api, {
      headers: { ...headers, 'x-tenant-id': String(tenantA._id) }
    });
    assert.equal(list.status, 200);
    const listBody = await list.json() as { data: Array<{ name: string }>; pagination: { total: number } };
    assert.equal(listBody.pagination.total, 0);
    assert.deepEqual(listBody.data, []);

    const crossTenantRead = await fetch(`${api}/${foreignProduct._id}`, {
      headers: { ...headers, 'x-tenant-id': String(tenantA._id) }
    });
    assert.equal(crossTenantRead.status, 404);

    const crossTenantUpdate = await fetch(`${api}/${foreignProduct._id}`, {
      method: 'PATCH',
      headers: { ...headers, 'x-tenant-id': String(tenantA._id) },
      body: JSON.stringify({ name: 'Unauthorized edit' })
    });
    assert.equal(crossTenantUpdate.status, 404);

    const attemptedTenantOverride = await fetch(api, {
      method: 'POST',
      headers: { ...headers, 'x-tenant-id': String(tenantA._id) },
      body: JSON.stringify({
        tenantId: String(tenantB._id),
        sku: 'ATTACK-001',
        name: 'Tenant override attempt',
        costPriceMinor: 100,
        sellingPriceMinor: 150,
        currency: 'GBP'
      })
    });
    assert.equal(attemptedTenantOverride.status, 400);

    const create = await fetch(api, {
      method: 'POST',
      headers: { ...headers, 'x-tenant-id': String(tenantA._id) },
      body: JSON.stringify({
        sku: 'TENANT-A-001',
        name: 'Tenant A phone',
        costPriceMinor: 10000,
        sellingPriceMinor: 15000,
        quantityOnHand: 3,
        currency: 'GBP'
      })
    });
    assert.equal(create.status, 201);
    const createBody = await create.json() as { product: { _id: string; tenantId: string; sku: string; quantityOnHand: number } };
    assert.equal(createBody.product.tenantId, String(tenantA._id));
    assert.equal(createBody.product.sku, 'TENANT-A-001');
    assert.equal(createBody.product.quantityOnHand, 3);

    const salesApi = `http://127.0.0.1:${address.port}/api/v1/sales`;
    const crossTenantSale = await fetch(salesApi, {
      method: 'POST',
      headers: { ...headers, 'x-tenant-id': String(tenantA._id) },
      body: JSON.stringify({
        items: [{ productId: String(foreignProduct._id), quantity: 1 }],
        paymentMethod: 'cash'
      })
    });
    assert.equal(crossTenantSale.status, 400);
    assert.equal((await Product.findById(foreignProduct._id))?.quantityOnHand, 0);

    const saleResponse = await fetch(salesApi, {
      method: 'POST',
      headers: { ...headers, 'x-tenant-id': String(tenantA._id) },
      body: JSON.stringify({
        items: [{ productId: createBody.product._id, quantity: 2 }],
        paymentMethod: 'cash',
        customerName: 'Test customer'
      })
    });
    assert.equal(saleResponse.status, 201);
    const saleBody = await saleResponse.json() as { sale: { totalMinor: number; items: Array<{ unitPriceMinor: number; quantity: number }> } };
    assert.equal(saleBody.sale.totalMinor, 30000);
    assert.equal(saleBody.sale.items[0]?.unitPriceMinor, 15000);
    assert.equal((await Product.findById(createBody.product._id))?.quantityOnHand, 1);

    const oversell = await fetch(salesApi, {
      method: 'POST',
      headers: { ...headers, 'x-tenant-id': String(tenantA._id) },
      body: JSON.stringify({
        items: [{ productId: createBody.product._id, quantity: 2 }],
        paymentMethod: 'cash'
      })
    });
    assert.equal(oversell.status, 409);
    assert.equal((await Product.findById(createBody.product._id))?.quantityOnHand, 1);
    const tenantBSales = await fetch(salesApi, { headers: { ...headers, 'x-tenant-id': String(tenantB._id) } });
    assert.equal(tenantBSales.status, 200);
    const tenantBSalesBody = await tenantBSales.json() as { data: unknown[] };
    assert.deepEqual(tenantBSalesBody.data, []);

    const publicApi = `http://127.0.0.1:${address.port}/api/v1/public/shops`;
    const tenantAStorefront = await fetch(`${publicApi}/${tenantA.slug}`);
    assert.equal(tenantAStorefront.status, 200);
    const tenantABody = await tenantAStorefront.json() as {
      products: Array<Record<string, unknown>>;
      shop: { slug: string; branding: Record<string, unknown> };
    };
    assert.equal(tenantABody.shop.slug, tenantA.slug);
    assert.deepEqual(tenantABody.products.map(product => product.name), ['Tenant A phone']);
    assert.equal('sku' in tenantABody.products[0]!, false);
    assert.equal('costPriceMinor' in tenantABody.products[0]!, false);
    assert.equal('reorderLevel' in tenantABody.products[0]!, false);
    assert.equal(tenantAStorefront.headers.get('cache-control'), 'no-store');

    const tenantBStorefront = await fetch(`${publicApi}/${tenantB.slug}`);
    assert.equal(tenantBStorefront.status, 200);
    const tenantBBody = await tenantBStorefront.json() as {
      products: Array<Record<string, unknown>>;
      shop: { slug: string };
    };
    assert.equal(tenantBBody.shop.slug, tenantB.slug);
    assert.deepEqual(tenantBBody.products.map(product => product.name), ['Private tenant B stock']);
    assert.equal('sku' in tenantBBody.products[0]!, false);
    assert.equal('costPriceMinor' in tenantBBody.products[0]!, false);

    const cashier = await User.create({
      name: 'Shop Cashier',
      email: `${randomUUID()}@example.test`,
      passwordHash: 'not-used-by-this-test',
      emailVerifiedAt: new Date()
    });
    await TenantMembership.create({
      tenantId: tenantA._id,
      userId: cashier._id,
      role: 'cashier',
      status: 'active'
    });
    const cashierToken = jwt.sign(
      { platformRole: 'user' },
      secret,
      { subject: String(cashier._id), expiresIn: '15m' }
    );
    const cashierCannotEditStorefront = await fetch('http://127.0.0.1:' + address.port + '/api/v1/shop/profile', {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${cashierToken}`,
        'x-tenant-id': String(tenantA._id),
        'content-type': 'application/json'
      },
      body: JSON.stringify({ displayName: 'Cashier changed the shop' })
    });
    assert.equal(cashierCannotEditStorefront.status, 403);

    const storefrontProfile = await fetch('http://127.0.0.1:' + address.port + '/api/v1/shop/profile', {
      method: 'PATCH',
      headers: { ...headers, 'x-tenant-id': String(tenantA._id) },
      body: JSON.stringify({
        displayName: 'Tenant A Mobile',
        primaryColor: '#103050',
        storefrontEnabled: false,
        unknownInternalSetting: true
      })
    });
    assert.equal(storefrontProfile.status, 400);

    const storefrontBeforeSettingChange = await fetch(`${publicApi}/${tenantA.slug}`, {
      method: 'GET',
      headers: { ...headers, 'x-tenant-id': String(tenantA._id) }
    });
    assert.equal(storefrontBeforeSettingChange.status, 200);

    const saveStorefrontSettings = await fetch('http://127.0.0.1:' + address.port + '/api/v1/shop/profile', {
      method: 'PATCH',
      headers: { ...headers, 'x-tenant-id': String(tenantA._id) },
      body: JSON.stringify({
        displayName: 'Tenant A Mobile',
        primaryColor: '#103050',
        timeZone: 'Asia/Karachi'
      })
    });
    assert.equal(saveStorefrontSettings.status, 200);
    const updatedPublicStorefront = await fetch(`${publicApi}/${tenantA.slug}`);
    assert.equal(updatedPublicStorefront.status, 200);
    const updatedPublicBody = await updatedPublicStorefront.json() as {
      shop: { branding: { displayName: string; primaryColor: string }; businessSettings: { timeZone: string } };
    };
    assert.equal(updatedPublicBody.shop.branding.displayName, 'Tenant A Mobile');
    assert.equal(updatedPublicBody.shop.branding.primaryColor, '#103050');
    assert.equal(updatedPublicBody.shop.businessSettings.timeZone, 'Asia/Karachi');

    const disableStorefront = await fetch('http://127.0.0.1:' + address.port + '/api/v1/shop/profile', {
      method: 'PATCH',
      headers: { ...headers, 'x-tenant-id': String(tenantA._id) },
      body: JSON.stringify({ storefrontEnabled: false })
    });
    assert.equal(disableStorefront.status, 200);
    const hiddenStorefront = await fetch(`${publicApi}/${tenantA.slug}`);
    assert.equal(hiddenStorefront.status, 404);

    const disabledFeatureTenant = await Tenant.create({
      name: 'Inventory Disabled',
      slug: `no-inventory-${randomUUID().slice(0, 8)}`,
      status: 'active',
      ownerUserId: user._id,
      planId: plan._id
    });
    const disabledPlan = await Plan.create({
      name: 'No inventory',
      code: `no-inventory-${randomUUID().slice(0, 8)}`,
      monthlyPriceMinor: 100,
      yearlyPriceMinor: 1000,
      currency: 'GBP',
      features: { ...featureSet, inventory: false, ecommerce: false }
    });
    disabledFeatureTenant.planId = disabledPlan._id;
    await disabledFeatureTenant.save();
    await TenantMembership.create({
      tenantId: disabledFeatureTenant._id,
      userId: user._id,
      role: 'owner',
      status: 'active'
    });
    await Subscription.create({
      tenantId: disabledFeatureTenant._id,
      planId: disabledPlan._id,
      status: 'active',
      billingInterval: 'month',
      currentPeriodStart: new Date(),
      currentPeriodEnd: periodEnd
    });
    const disabledFeatureResponse = await fetch(api, {
      headers: { ...headers, 'x-tenant-id': String(disabledFeatureTenant._id) }
    });
    assert.equal(disabledFeatureResponse.status, 403);
    const disabledEcommerceStorefront = await fetch(`${publicApi}/${disabledFeatureTenant.slug}`);
    assert.equal(disabledEcommerceStorefront.status, 404);
  } finally {
    if (server?.listening) {
      await new Promise<void>((resolve, reject) =>
        server!.close(error => error ? reject(error) : resolve())
      );
    }
    await Promise.all([
      User.deleteMany({}),
      Tenant.deleteMany({}),
      TenantMembership.deleteMany({}),
      Subscription.deleteMany({}),
      Plan.deleteMany({}),
      Product.deleteMany({}),
      SignupRequest.deleteMany({}),
      AuditLog.deleteMany({}),
      DomainMapping.deleteMany({})
    ]);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
