import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { requireActiveSubscription, requireTenantMembership } from '../middleware/tenantAuthorization';
import { Plan } from '../models/Plan';
import { Subscription } from '../models/Subscription';
import { Tenant } from '../models/Tenant';
import { asyncHandler, HttpError } from '../utils/http';
import { resolveEntitlements } from '../services/entitlements';

const clockTime = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const httpUrl = z.string().trim().max(2048).refine(value => {
  if (!value) return true;
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}, 'Enter a valid HTTP or HTTPS URL.');
const timeZone = z.string().trim().min(1).max(100).refine(value => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}, 'Enter a valid IANA time zone.');

const weekSchedule = z.object({
  mon: z.object({ open: clockTime, close: clockTime, closed: z.boolean() }).strict(),
  tue: z.object({ open: clockTime, close: clockTime, closed: z.boolean() }).strict(),
  wed: z.object({ open: clockTime, close: clockTime, closed: z.boolean() }).strict(),
  thu: z.object({ open: clockTime, close: clockTime, closed: z.boolean() }).strict(),
  fri: z.object({ open: clockTime, close: clockTime, closed: z.boolean() }).strict(),
  sat: z.object({ open: clockTime, close: clockTime, closed: z.boolean() }).strict(),
  sun: z.object({ open: clockTime, close: clockTime, closed: z.boolean() }).strict()
}).strict();

const shopProfilePatch = z.object({
  displayName: z.string().trim().min(2).max(120).optional(),
  logoUrl: httpUrl.or(z.literal('')).optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  contactEmail: z.string().trim().email().max(254).or(z.literal('')).optional(),
  contactPhone: z.string().trim().max(40).optional(),
  address: z.string().trim().max(300).optional(),
  openingHours: weekSchedule.optional(),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).optional(),
  timeZone: timeZone.optional(),
  description: z.string().trim().max(1000).optional(),
  announcement: z.string().trim().max(240).optional(),
  storefrontEnabled: z.boolean().optional(),
  socialLinks: z.object({
    facebook: httpUrl.or(z.literal('')),
    instagram: httpUrl.or(z.literal('')),
    tiktok: httpUrl.or(z.literal(''))
  }).strict().optional()
}).strict().refine(input => Object.keys(input).length > 0, 'At least one shop setting must be provided.');

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

  router.patch('/profile', requireActiveSubscription, asyncHandler(async (request, response) => {
    const context = request.tenantContext;
    if (!context) throw new HttpError(500, 'Tenant authorization middleware is missing.', 'MIDDLEWARE_MISCONFIGURED');
    if (!['owner', 'admin'].includes(context.membership.role)) {
      throw new HttpError(403, 'Only shop owners and administrators can change storefront settings.', 'SHOP_SETTINGS_FORBIDDEN');
    }
    const input = shopProfilePatch.parse(request.body);
    const { displayName, logoUrl, primaryColor, secondaryColor, contactEmail, contactPhone, address,
      openingHours, currency, timeZone: shopTimeZone, description, announcement, storefrontEnabled, socialLinks } = input;
    const update: Record<string, unknown> = {};
    if (displayName !== undefined) update['branding.displayName'] = displayName;
    if (logoUrl !== undefined) update['branding.logoUrl'] = logoUrl;
    if (primaryColor !== undefined) update['branding.primaryColor'] = primaryColor;
    if (secondaryColor !== undefined) update['branding.secondaryColor'] = secondaryColor;
    if (contactEmail !== undefined) update['branding.contactEmail'] = contactEmail;
    if (contactPhone !== undefined) update['branding.contactPhone'] = contactPhone;
    if (address !== undefined) update['branding.address'] = address;
    if (openingHours !== undefined) update['branding.openingHours'] = openingHours;
    if (currency !== undefined) update['businessSettings.currency'] = currency;
    if (shopTimeZone !== undefined) update['businessSettings.timeZone'] = shopTimeZone;
    if (description !== undefined) update['branding.storefrontContent.description'] = description;
    if (announcement !== undefined) update['branding.storefrontContent.announcement'] = announcement;
    if (storefrontEnabled !== undefined) update['branding.storefrontContent.enabled'] = storefrontEnabled;
    if (socialLinks !== undefined) update['branding.storefrontContent.socialLinks'] = socialLinks;
    const tenant = await Tenant.findByIdAndUpdate(
      context.tenantId,
      { $set: update },
      { new: true, runValidators: true }
    ).select('name slug branding businessSettings status').lean();
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
