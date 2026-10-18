import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import {
  requireActiveSubscription,
  requireFeature,
  requireTenantMembership
} from '../middleware/tenantAuthorization';
import { initializeTenantDataModels } from '../db/tenantDatabase';
import { InventoryService } from '../services/inventory';
import { asyncHandler, HttpError } from '../utils/http';

const productFields = z.object({
  productCode: z.string().trim().max(64).transform(value => value.toUpperCase()).default(''),
  sku: z.string().trim().min(1).max(64).transform(value => value.toUpperCase()),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).default(''),
  brand: z.string().trim().max(100).default(''),
  itemType: z.string().trim().min(1).max(64).default('Product'),
  model: z.string().trim().max(100).default(''),
  branch: z.string().trim().min(1).max(120).default('Main branch'),
  category: z.string().trim().min(1).max(100).default('General'),
  color: z.string().trim().max(64).default(''),
  supplierName: z.string().trim().max(120).default(''),
  supplierInvoiceNumber: z.string().trim().max(64).default(''),
  barcode: z.string().trim().max(128).nullable().default(null),
  costPriceMinor: z.number().int().safe().min(0),
  sellingPriceMinor: z.number().int().safe().min(0),
  minimumPriceMinor: z.number().int().safe().min(0).default(0),
  quantityOnHand: z.number().int().safe().min(0).default(0),
  showOnPos: z.boolean().default(true),
  firstPurchaseDate: z.string().date().nullable().default(null),
  expiryDate: z.string().date().nullable().default(null),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  reorderLevel: z.number().int().safe().min(0).default(0)
}).strict();

const productInput = productFields.refine(
  input => input.minimumPriceMinor <= input.sellingPriceMinor,
  { message: 'Minimum price cannot exceed the retail price.', path: ['minimumPriceMinor'] }
);

const productPatch = productFields.omit({ sku: true, currency: true }).partial().strict().refine(
  input => Object.keys(input).length > 0,
  'At least one product field must be provided.'
);

const listQuery = z.object({
  search: z.string().trim().max(100).optional(),
  category: z.string().trim().min(1).max(100).optional(),
  itemType: z.string().trim().min(1).max(64).optional(),
  hideZeroQuantity: z.enum(['true', 'false']).default('false').transform(value => value === 'true'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  includeArchived: z.enum(['true', 'false']).default('false').transform(value => value === 'true'),
  posOnly: z.enum(['true', 'false']).default('false').transform(value => value === 'true')
}).strict();

const suggestionQuery = z.object({
  field: z.enum(['brand', 'itemType', 'category', 'name', 'model']),
  query: z.string().trim().max(100).default('')
}).strict();

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const createProductsRouter = (): Router => {
  const router = Router();
  router.use(
    requireAuth,
    requireTenantMembership,
    requireActiveSubscription,
    requireFeature('inventory')
  );

  router.get('/suggestions', asyncHandler(async (request, response) => {
    const context = request.tenantContext;
    if (!context) throw new HttpError(500, 'Tenant authorization middleware is missing.', 'MIDDLEWARE_MISCONFIGURED');
    const { field, query } = suggestionQuery.parse(request.query);
    const Product = (await initializeTenantDataModels(
      context.tenantId,
      context.tenant.storage?.databaseName
    )).Product;
    const matches = await Product.aggregate<{ value: string }>([
      {
        $match: {
          tenantId: context.tenantId,
          status: 'active',
          [field]: { $type: 'string', $regex: `^${escapeRegex(query)}`, $options: 'i' }
        }
      },
      { $group: { _id: { $toLower: `$${field}` }, value: { $first: `$${field}` } } },
      { $sort: { value: 1 } },
      { $limit: 3 }
    ]);
    response.setHeader('Cache-Control', 'no-store');
    response.json({ data: matches.map(match => match.value) });
  }));

  router.get('/filters', asyncHandler(async (request, response) => {
    const context = request.tenantContext;
    if (!context) throw new HttpError(500, 'Tenant authorization middleware is missing.', 'MIDDLEWARE_MISCONFIGURED');
    const Product = (await initializeTenantDataModels(
      context.tenantId,
      context.tenant.storage?.databaseName
    )).Product;
    const values = await Product.distinct('itemType', {
      tenantId: context.tenantId,
      status: 'active',
      itemType: { $type: 'string', $ne: '' }
    });
    const itemTypes = values
      .filter((value): value is string => typeof value === 'string')
      .sort((left, right) => left.localeCompare(right));
    response.setHeader('Cache-Control', 'no-store');
    response.json({ itemTypes });
  }));

  router.get('/', asyncHandler(async (request, response) => {
    const context = request.tenantContext;
    if (!context) throw new HttpError(500, 'Tenant authorization middleware is missing.', 'MIDDLEWARE_MISCONFIGURED');
    const query = listQuery.parse(request.query);
    const productModel = (await initializeTenantDataModels(
      context.tenantId,
      context.tenant.storage?.databaseName
    )).Product;
      const page = await new InventoryService(() => productModel).list(context.tenantId, query);
    response.json({ data: page.items, pagination: { page: page.page, limit: page.limit, total: page.total } });
  }));

  router.post('/', asyncHandler(async (request, response) => {
    const context = request.tenantContext;
    if (!context) throw new HttpError(500, 'Tenant authorization middleware is missing.', 'MIDDLEWARE_MISCONFIGURED');
    const input = productInput.parse(request.body);
    const productModel = (await initializeTenantDataModels(
      context.tenantId,
      context.tenant.storage?.databaseName
    )).Product;
    const product = await new InventoryService(() => productModel).create(context.tenantId, context.userId, input);
    response.status(201).json({ product });
  }));

  router.get('/:productId', asyncHandler(async (request, response) => {
    const context = request.tenantContext;
    if (!context) throw new HttpError(500, 'Tenant authorization middleware is missing.', 'MIDDLEWARE_MISCONFIGURED');
    const productId = request.params.productId;
    if (typeof productId !== 'string') throw new HttpError(400, 'Product id is invalid.', 'INVALID_PRODUCT_ID');
    const productModel = (await initializeTenantDataModels(
      context.tenantId,
      context.tenant.storage?.databaseName
    )).Product;
    const product = await new InventoryService(() => productModel).get(context.tenantId, productId);
    if (!product) throw new HttpError(404, 'Product not found.', 'PRODUCT_NOT_FOUND');
    response.json({ product });
  }));

  router.patch('/:productId', asyncHandler(async (request, response) => {
    const context = request.tenantContext;
    if (!context) throw new HttpError(500, 'Tenant authorization middleware is missing.', 'MIDDLEWARE_MISCONFIGURED');
    const productId = request.params.productId;
    if (typeof productId !== 'string') throw new HttpError(400, 'Product id is invalid.', 'INVALID_PRODUCT_ID');
    const patch = productPatch.parse(request.body);
    const productModel = (await initializeTenantDataModels(
      context.tenantId,
      context.tenant.storage?.databaseName
    )).Product;
    const inventory = new InventoryService(() => productModel);
    if (patch.minimumPriceMinor !== undefined || patch.sellingPriceMinor !== undefined) {
      const currentProduct = await inventory.get(context.tenantId, productId);
      if (!currentProduct) throw new HttpError(404, 'Product not found.', 'PRODUCT_NOT_FOUND');
      const minimum = patch.minimumPriceMinor ?? currentProduct.minimumPriceMinor ?? 0;
      const retail = patch.sellingPriceMinor ?? currentProduct.sellingPriceMinor;
      if (minimum > retail) {
        throw new HttpError(400, 'Minimum price cannot exceed the retail price.', 'INVALID_PRODUCT_PRICING');
      }
    }
    const product = await inventory.update(
      context.tenantId,
      context.userId,
      productId,
      patch
    );
    if (!product) throw new HttpError(404, 'Product not found.', 'PRODUCT_NOT_FOUND');
    response.json({ product });
  }));

  router.delete('/:productId', asyncHandler(async (request, response) => {
    const context = request.tenantContext;
    if (!context) throw new HttpError(500, 'Tenant authorization middleware is missing.', 'MIDDLEWARE_MISCONFIGURED');
    const productId = request.params.productId;
    if (typeof productId !== 'string') throw new HttpError(400, 'Product id is invalid.', 'INVALID_PRODUCT_ID');
    const productModel = (await initializeTenantDataModels(
      context.tenantId,
      context.tenant.storage?.databaseName
    )).Product;
    const product = await new InventoryService(() => productModel).archive(
      context.tenantId,
      context.userId,
      productId
    );
    if (!product) throw new HttpError(404, 'Product not found.', 'PRODUCT_NOT_FOUND');
    response.json({ product });
  }));

  return router;
};
