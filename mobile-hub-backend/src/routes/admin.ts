import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { requireAuth, requireSuperAdmin } from '../middleware/auth';
import { FEATURE_KEYS } from '../config/features';
import { AuditLog } from '../models/AuditLog';
import { Plan } from '../models/Plan';
import { SignupRequest } from '../models/SignupRequest';
import { MongooseApprovalStore } from '../services/signup';
import { asyncHandler, HttpError } from '../utils/http';

const approveSchema = z.object({
  planId: z.string().refine(mongoose.isValidObjectId, 'Invalid plan id.'),
  trialDays: z.coerce.number().int().min(0).max(90).optional()
}).strict();

const rejectSchema = z.object({
  reason: z.string().trim().min(3).max(500)
}).strict();

const featureSetSchema = z.record(z.enum(FEATURE_KEYS), z.boolean())
  .refine(features => FEATURE_KEYS.every(feature => Object.hasOwn(features, feature)));

const planSchema = z.object({
  name: z.string().trim().min(2).max(80),
  code: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{1,40}$/),
  description: z.string().trim().max(500).default(''),
  monthlyPriceMinor: z.number().int().min(0),
  yearlyPriceMinor: z.number().int().min(0),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  features: featureSetSchema,
  limits: z.object({
    staff: z.number().int().min(1).default(1),
    branches: z.number().int().min(1).default(1),
    products: z.number().int().min(1).default(1000),
    storageBytes: z.number().int().min(0).default(1073741824)
  }).default({ staff: 1, branches: 1, products: 1000, storageBytes: 1073741824 }),
  trialDays: z.number().int().min(0).max(90).default(0),
  active: z.boolean().default(true),
  optionalAddons: z.array(z.enum(FEATURE_KEYS)).default([])
}).strict();

export const createAdminRouter = (): Router => {
  const router = Router();
  router.use(requireAuth, requireSuperAdmin);

  router.get('/applications', asyncHandler(async (request, response) => {
    const page = z.coerce.number().int().min(1).default(1).parse(request.query.page);
    const limit = z.coerce.number().int().min(1).max(100).default(25).parse(request.query.limit);
    const [applications, total] = await Promise.all([
      SignupRequest.find({ status: 'pending' })
        .select('tenantId ownerUserId shopName requestedSlug ownerName email phone requestedPlanId createdAt')
        .populate({ path: 'requestedPlanId', select: 'name code monthlyPriceMinor yearlyPriceMinor currency' })
        .sort({ createdAt: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      SignupRequest.countDocuments({ status: 'pending' })
    ]);
    response.json({ data: applications, pagination: { page, limit, total } });
  }));

  router.get('/plans', asyncHandler(async (_request, response) => {
    const plans = await Plan.find().sort({ createdAt: -1 }).lean();
    response.json({ data: plans });
  }));

  router.post('/plans', asyncHandler(async (request, response) => {
    const input = planSchema.parse(request.body);
    const actorId = request.auth?.userId;
    if (!actorId) throw new HttpError(401, 'Authentication is required.', 'UNAUTHENTICATED');
    const session = await mongoose.startSession();
    let createdPlan: unknown;
    try {
      await session.withTransaction(async () => {
        const [plan] = await Plan.create([input], { session });
        if (!plan) throw new Error('Plan creation failed.');
        createdPlan = plan.toJSON();
        await AuditLog.create([{
          actorUserId: new mongoose.Types.ObjectId(actorId),
          action: 'plan.created',
          targetType: 'plan',
          targetId: String(plan._id),
          metadata: {
            code: plan.code,
            monthlyPriceMinor: plan.monthlyPriceMinor,
            yearlyPriceMinor: plan.yearlyPriceMinor
          }
        }], { session });
      });
    } finally {
      await session.endSession();
    }
    response.status(201).json({ plan: createdPlan });
  }));

  router.patch('/plans/:id', asyncHandler(async (request, response) => {
    const planId = request.params.id;
    if (typeof planId !== 'string' || !mongoose.isValidObjectId(planId)) {
      throw new HttpError(400, 'Plan id is invalid.', 'INVALID_PLAN_ID');
    }
    const patchSchema = planSchema.partial().strict();
    const input = patchSchema.parse(request.body);
    const actorId = request.auth?.userId;
    if (!actorId) throw new HttpError(401, 'Authentication is required.', 'UNAUTHENTICATED');
    if (Object.keys(input).length === 0) {
      throw new HttpError(400, 'At least one plan field must be provided.', 'EMPTY_PLAN_UPDATE');
    }
    const session = await mongoose.startSession();
    let updatedPlan: unknown;
    try {
      await session.withTransaction(async () => {
        const plan = await Plan.findByIdAndUpdate(
          planId,
          { $set: input },
          { new: true, runValidators: true, session }
        );
        if (!plan) throw new HttpError(404, 'Plan not found.', 'PLAN_NOT_FOUND');
        updatedPlan = plan.toJSON();
        await AuditLog.create([{
          actorUserId: new mongoose.Types.ObjectId(actorId),
          action: 'plan.updated',
          targetType: 'plan',
          targetId: String(plan._id),
          metadata: { changedFields: Object.keys(input).sort() }
        }], { session });
      });
    } finally {
      await session.endSession();
    }
    response.json({ plan: updatedPlan });
  }));

  router.post('/applications/:id/approve', asyncHandler(async (request, response) => {
    const requestId = request.params.id;
    if (typeof requestId !== 'string' || !mongoose.isValidObjectId(requestId)) {
      throw new HttpError(400, 'Application id is invalid.', 'INVALID_APPLICATION_ID');
    }
    const input = approveSchema.parse(request.body);
    const reviewerId = request.auth?.userId;
    if (!reviewerId) throw new HttpError(401, 'Authentication is required.', 'UNAUTHENTICATED');
    const store = new MongooseApprovalStore();
    await store.approveApplication({
      requestId,
      reviewerId,
      planId: input.planId,
      trialDays: input.trialDays
    });
    response.json({ message: 'Application approved.' });
  }));

  router.post('/applications/:id/reject', asyncHandler(async (request, response) => {
    const requestId = request.params.id;
    if (typeof requestId !== 'string' || !mongoose.isValidObjectId(requestId)) {
      throw new HttpError(400, 'Application id is invalid.', 'INVALID_APPLICATION_ID');
    }
    const { reason } = rejectSchema.parse(request.body);
    const reviewerId = request.auth?.userId;
    if (!reviewerId) throw new HttpError(401, 'Authentication is required.', 'UNAUTHENTICATED');
    await new MongooseApprovalStore().rejectApplication({
      requestId,
      reviewerId,
      reason
    });
    response.json({ message: 'Application rejected.' });
  }));

  return router;
};
