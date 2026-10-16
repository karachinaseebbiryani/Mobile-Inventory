import mongoose from 'mongoose';
import type { RequestHandler } from 'express';
import { FEATURE_KEYS, type FeatureKey } from '../config/features';
import { Plan } from '../models/Plan';
import { Subscription } from '../models/Subscription';
import { Tenant } from '../models/Tenant';
import { TenantMembership } from '../models/TenantMembership';
import { resolveEntitlements } from '../services/entitlements';
import { HttpError } from '../utils/http';

export const requireTenantMembership: RequestHandler = async (request, _response, next) => {
  try {
    if (!request.auth) throw new HttpError(401, 'Authentication is required.', 'UNAUTHENTICATED');
    const tenantId = request.header('x-tenant-id');
    if (!tenantId || !mongoose.isValidObjectId(tenantId)) {
      throw new HttpError(400, 'A valid X-Tenant-Id header is required.', 'INVALID_TENANT');
    }

    const membership = await TenantMembership.findOne({
      tenantId,
      userId: request.auth.userId,
      status: 'active'
    }).lean();
    if (!membership) throw new HttpError(403, 'You do not have access to this shop.', 'TENANT_ACCESS_DENIED');

    const tenant = await Tenant.findById(tenantId)
      .select('status planId featureOverrides')
      .lean();
    if (!tenant) throw new HttpError(404, 'Shop not found.', 'TENANT_NOT_FOUND');

    request.tenantContext = {
      tenantId: tenant._id,
      userId: membership.userId,
      tenant,
      membership: { role: membership.role, permissions: membership.permissions }
    };
    next();
  } catch (error) {
    next(error);
  }
};

export const requireActiveSubscription: RequestHandler = async (request, _response, next) => {
  try {
    const context = request.tenantContext;
    if (!context) throw new HttpError(500, 'Tenant authorization middleware is missing.', 'MIDDLEWARE_MISCONFIGURED');
    const subscription = await Subscription.findOne({ tenantId: context.tenantId }).lean();
    const plan = subscription ? await Plan.findById(subscription.planId).lean() : null;
    const resolved = resolveEntitlements({
      tenantStatus: context.tenant.status,
      subscriptionStatus: subscription?.status || 'pending',
      currentPeriodEnd: subscription?.currentPeriodEnd,
      planFeatures: plan?.features || {},
      addOnFeatures: subscription?.addOnFeatures || {},
      overrides: context.tenant.featureOverrides
    });
    if (resolved.reason === 'tenant_inactive') {
      throw new HttpError(403, 'This shop is not active.', 'TENANT_INACTIVE');
    }
    if (!resolved.allowed) {
      throw new HttpError(402, 'An active subscription or authorized trial is required.', 'SUBSCRIPTION_REQUIRED');
    }
    context.entitlements = resolved.features;
    next();
  } catch (error) {
    next(error);
  }
};

export const requireFeature = (feature: FeatureKey): RequestHandler => (request, _response, next) => {
  const entitlements = request.tenantContext?.entitlements;
  if (!entitlements) {
    next(new HttpError(500, 'Subscription authorization middleware is missing.', 'MIDDLEWARE_MISCONFIGURED'));
    return;
  }
  if (!FEATURE_KEYS.includes(feature) || entitlements[feature] !== true) {
    next(new HttpError(403, `The ${feature} feature is not enabled for this shop.`, 'FEATURE_DISABLED'));
    return;
  }
  next();
};
