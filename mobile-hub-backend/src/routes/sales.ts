import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { initializeTenantDataModels } from '../db/tenantDatabase';
import {
  requireActiveSubscription,
  requireFeature,
  requireTenantMembership
} from '../middleware/tenantAuthorization';
import { createSale, listSales } from '../services/sales';
import { asyncHandler, HttpError } from '../utils/http';

const createSaleSchema = z.object({
  items: z.array(z.object({
    productId: z.string().refine(value => /^[a-f\d]{24}$/i.test(value), 'Invalid product ID.'),
    quantity: z.number().int().safe().min(1).max(10000)
  }).strict()).min(1).max(100),
  paymentMethod: z.enum(['cash', 'card', 'other']),
  customerName: z.string().trim().max(120).default('')
}).strict();

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25)
}).strict();

export const createSalesRouter = (): Router => {
  const router = Router();
  router.use(
    requireAuth,
    requireTenantMembership,
    requireActiveSubscription,
    requireFeature('pos'),
    requireFeature('inventory')
  );

  router.get('/', asyncHandler(async (request, response) => {
    const context = request.tenantContext;
    if (!context) throw new HttpError(500, 'Tenant authorization middleware is missing.', 'MIDDLEWARE_MISCONFIGURED');
    const query = listQuery.parse(request.query);
    const models = await initializeTenantDataModels(context.tenantId, context.tenant.storage?.databaseName);
    const result = await listSales(context.tenantId, query.page, query.limit, models);
    response.json({ data: result.items, pagination: { page: result.page, limit: result.limit, total: result.total } });
  }));

  router.post('/', asyncHandler(async (request, response) => {
    const context = request.tenantContext;
    if (!context) throw new HttpError(500, 'Tenant authorization middleware is missing.', 'MIDDLEWARE_MISCONFIGURED');
    const input = createSaleSchema.parse(request.body);
    const models = await initializeTenantDataModels(context.tenantId, context.tenant.storage?.databaseName);
    const sale = await createSale(context.tenantId, context.userId, input, models);
    response.status(201).json({ sale });
  }));

  return router;
};
