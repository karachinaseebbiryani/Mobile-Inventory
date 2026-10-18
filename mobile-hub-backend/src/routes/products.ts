import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import {
  requireActiveSubscription,
  requireFeature,
  requireTenantMembership
} from '../middleware/tenantAuthorization';
import { InventoryService } from '../services/inventory';
import { asyncHandler, HttpError } from '../utils/http';

const productInput = z.object({
  sku: z.string().trim().min(1).max(64).transform(value => value.toUpperCase()),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).default(''),
  brand: z.string().trim().max(100).default(''),
  model: z.string().trim().max(100).default(''),
  category: z.string().trim().min(1).max(100).default('General'),
  barcode: z.string().trim().max(128).nullable().default(null),
  costPriceMinor: z.number().int().safe().min(0),
  sellingPriceMinor: z.number().int().safe().min(0),
  quantityOnHand: z.number().int().safe().min(0).default(0),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  reorderLevel: z.number().int().safe().min(0).default(0)
}).strict();

const productPatch = productInput.omit({ sku: true, currency: true }).partial().strict().refine(
  input => Object.keys(input).length > 0,
  'At least one product field must be provided.'
);

const listQuery = z.object({
  search: z.string().trim().max(100).optional(),
  category: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  includeArchived: z.enum(['true', 'false']).default('false').transform(value => value === 'true')
}).strict();

export const createProductsRouter = (inventory = new InventoryService()): Router => {
  const router = Router();
  router.use(
    requireAuth,
    requireTenantMembership,
    requireActiveSubscription,
    requireFeature('inventory')
  );

  router.get('/', asyncHandler(async (request, response) => {
    const query = listQuery.parse(request.query);
    const page = await inventory.list(request.tenantContext!.tenantId, query);
    response.json({ data: page.items, pagination: { page: page.page, limit: page.limit, total: page.total } });
  }));

  router.post('/', asyncHandler(async (request, response) => {
    const context = request.tenantContext;
    if (!context) throw new HttpError(500, 'Tenant authorization middleware is missing.', 'MIDDLEWARE_MISCONFIGURED');
    const input = productInput.parse(request.body);
    const product = await inventory.create(context.tenantId, context.userId, input);
    response.status(201).json({ product });
  }));

  router.get('/:productId', asyncHandler(async (request, response) => {
    const context = request.tenantContext;
    if (!context) throw new HttpError(500, 'Tenant authorization middleware is missing.', 'MIDDLEWARE_MISCONFIGURED');
    const productId = request.params.productId;
    if (typeof productId !== 'string') throw new HttpError(400, 'Product id is invalid.', 'INVALID_PRODUCT_ID');
    const product = await inventory.get(context.tenantId, productId);
    if (!product) throw new HttpError(404, 'Product not found.', 'PRODUCT_NOT_FOUND');
    response.json({ product });
  }));

  router.patch('/:productId', asyncHandler(async (request, response) => {
    const context = request.tenantContext;
    if (!context) throw new HttpError(500, 'Tenant authorization middleware is missing.', 'MIDDLEWARE_MISCONFIGURED');
    const productId = request.params.productId;
    if (typeof productId !== 'string') throw new HttpError(400, 'Product id is invalid.', 'INVALID_PRODUCT_ID');
    const patch = productPatch.parse(request.body);
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
    const product = await inventory.archive(
      context.tenantId,
      context.userId,
      productId
    );
    if (!product) throw new HttpError(404, 'Product not found.', 'PRODUCT_NOT_FOUND');
    response.json({ product });
  }));

  return router;
};
