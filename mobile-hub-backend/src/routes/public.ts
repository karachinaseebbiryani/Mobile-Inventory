import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Plan } from '../models/Plan';
import { Product } from '../models/Product';
import { Subscription } from '../models/Subscription';
import { Tenant } from '../models/Tenant';
import { resolveEntitlements } from '../services/entitlements';
import { asyncHandler } from '../utils/http';

const storefrontQuery = z.object({
  search: z.string().trim().max(100).optional(),
  category: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30)
}).strict();

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const createPublicRouter = (): Router => {
  const router = Router();
  router.get('/plans', asyncHandler(async (_request, response) => {
    const plans = await Plan.find({ active: true })
      .select('name code description monthlyPriceMinor yearlyPriceMinor currency features limits trialDays optionalAddons')
      .sort({ monthlyPriceMinor: 1 })
      .lean();
    response.json({ data: plans });
  }));

  router.get('/shops/:slug', asyncHandler(async (request, response) => {
    const slug = z.string().regex(/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/).parse(request.params.slug);
    const query = storefrontQuery.parse(request.query);
    const tenant = await Tenant.findOne({ slug, status: 'active' })
      .select('name slug branding businessSettings status planId featureOverrides')
      .lean();
    if (!tenant || tenant.branding?.storefrontContent?.enabled === false) {
      response.status(404).json({ error: { code: 'STOREFRONT_NOT_FOUND', message: 'This shop is not available.' } });
      return;
    }

    const subscription = await Subscription.findOne({ tenantId: tenant._id }).lean();
    const plan = subscription ? await Plan.findById(subscription.planId).lean() : null;
    const entitlements = resolveEntitlements({
      tenantStatus: tenant.status,
      subscriptionStatus: subscription?.status || 'pending',
      currentPeriodEnd: subscription?.currentPeriodEnd,
      planFeatures: plan?.features || {},
      addOnFeatures: subscription?.addOnFeatures || {},
      overrides: tenant.featureOverrides
    });
    if (!entitlements.allowed || entitlements.features.ecommerce !== true) {
      response.status(404).json({ error: { code: 'STOREFRONT_NOT_FOUND', message: 'This shop is not available.' } });
      return;
    }

    const filter: mongoose.FilterQuery<InstanceType<typeof Product>> = {
      tenantId: tenant._id,
      status: 'active'
    };
    if (query.category) filter.category = query.category;
    if (query.search) {
      const search = new RegExp(escapeRegex(query.search), 'i');
      filter.$or = [{ name: search }, { brand: search }, { model: search }, { description: search }];
    }
    const [products, total, categories] = await Promise.all([
      Product.find(filter)
        .select('name description brand model category sellingPriceMinor currency')
        .sort({ category: 1, name: 1, _id: 1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      Product.countDocuments(filter),
      Product.distinct('category', { tenantId: tenant._id, status: 'active' })
    ]);

    const content = tenant.branding?.storefrontContent || {};
    response.setHeader('Cache-Control', 'no-store');
    response.json({
      shop: {
        name: tenant.name,
        slug: tenant.slug,
        branding: {
          displayName: tenant.branding?.displayName || tenant.name,
          logoUrl: tenant.branding?.logoUrl || '',
          primaryColor: tenant.branding?.primaryColor || '#2563eb',
          secondaryColor: tenant.branding?.secondaryColor || '#0f172a',
          contactEmail: tenant.branding?.contactEmail || '',
          contactPhone: tenant.branding?.contactPhone || '',
          address: tenant.branding?.address || '',
          openingHours: tenant.branding?.openingHours || {}
        },
        businessSettings: {
          currency: tenant.businessSettings?.currency || 'GBP',
          timeZone: tenant.businessSettings?.timeZone || 'Europe/London'
        },
        storefrontContent: {
          description: content.description || '',
          announcement: content.announcement || '',
          socialLinks: content.socialLinks || {}
        }
      },
      products,
      categories: categories.sort((a, b) => a.localeCompare(b)),
      pagination: { page: query.page, limit: query.limit, total }
    });
  }));

  return router;
};
