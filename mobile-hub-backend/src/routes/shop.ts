import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireActiveSubscription, requireTenantMembership } from '../middleware/tenantAuthorization';
import { Plan } from '../models/Plan';
import { Subscription } from '../models/Subscription';
import { Tenant } from '../models/Tenant';
import { asyncHandler, HttpError } from '../utils/http';
import { resolveEntitlements } from '../services/entitlements';

export const createShopRouter = (): Router => {
  const router = Router();
  router.use(requireAuth, requireTenantMembership);

  router.get('/profile', requireActiveSubscription, asyncHandler(async (request, response) => {
    const tenant = await Tenant.findById(request.tenantContext!.tenantId)
      .select('name slug branding businessSettings status')
      .lean();
    if (!tenant) throw new HttpError(404, 'Shop not found.', 'TENANT_NOT_FOUND');
    response.json({ shop: tenant });
  }));

  router.get('/features', requireActiveSubscription, asyncHandler(async (request, response) => {
    response.json({ features: request.tenantContext!.entitlements });
  }));

  router.get('/subscription', asyncHandler(async (request, response) => {
    const subscription = await Subscription.findOne({ tenantId: request.tenantContext!.tenantId })
      .select('-providerCustomerId -providerSubscriptionId')
      .populate({ path: 'planId', select: 'name code monthlyPriceMinor yearlyPriceMinor currency limits' })
      .lean();
    response.json({ subscription });
  }));

  router.get('/database/status', asyncHandler(async (request, response) => {
    const tenant = await Tenant.findById(request.tenantContext!.tenantId)
      .select('storage.mode storage.databaseName storage.connectionStatus storage.lastHealthCheckAt')
      .lean();
    if (!tenant) throw new HttpError(404, 'Shop not found.', 'TENANT_NOT_FOUND');
    response.json({ database: tenant.storage });
  }));

  return router;
};
