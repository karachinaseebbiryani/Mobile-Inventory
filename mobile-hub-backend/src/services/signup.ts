import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { AuditLog } from '../models/AuditLog';
import { Plan } from '../models/Plan';
import { SignupRequest } from '../models/SignupRequest';
import { Subscription } from '../models/Subscription';
import { Tenant } from '../models/Tenant';
import { TenantMembership } from '../models/TenantMembership';
import { User } from '../models/User';
import type { VerificationMailer } from './email';
import { HttpError } from '../utils/http';

export interface RegisterInput {
  shopName: string;
  slug: string;
  ownerName: string;
  email: string;
  password: string;
  phone: string;
  requestedPlanId?: string;
}

export interface RegistrationStore {
  createPendingApplication(data: {
    input: RegisterInput;
    passwordHash: string;
    verificationTokenHash: string;
    verificationExpiresAt: Date;
  }): Promise<void>;
}

export const hashVerificationToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

export interface ApprovalTransition {
  tenantStatus: 'active';
  membershipStatus: 'active';
  subscriptionStatus: 'trialing' | 'pending';
  periodStart: Date;
  periodEnd: Date | null;
  trialEnd: Date | null;
  trialDays: number;
}

export const prepareApplicationApproval = (input: {
  applicationStatus: string;
  tenantStatus: string;
  ownerEmailVerified: boolean;
  planActive: boolean;
  trialDays: number;
  now?: Date;
}): ApprovalTransition => {
  if (input.applicationStatus !== 'pending' || input.tenantStatus !== 'pending') {
    throw new HttpError(409, 'Application is no longer pending.', 'APPLICATION_NOT_PENDING');
  }
  if (!input.ownerEmailVerified) {
    throw new HttpError(409, 'The owner must verify their email before approval.', 'EMAIL_NOT_VERIFIED');
  }
  if (!input.planActive) throw new HttpError(400, 'The selected plan is unavailable.', 'INVALID_PLAN');
  if (!Number.isInteger(input.trialDays) || input.trialDays < 0 || input.trialDays > 90) {
    throw new HttpError(400, 'Trial duration must be between 0 and 90 days.', 'INVALID_TRIAL');
  }
  const now = input.now || new Date();
  const trialEnd = input.trialDays > 0
    ? new Date(now.getTime() + input.trialDays * 86400000)
    : null;
  return {
    tenantStatus: 'active',
    membershipStatus: 'active',
    subscriptionStatus: trialEnd ? 'trialing' : 'pending',
    periodStart: now,
    periodEnd: trialEnd,
    trialEnd,
    trialDays: input.trialDays
  };
};

export class MongooseRegistrationStore implements RegistrationStore {
  async createPendingApplication(data: {
    input: RegisterInput;
    passwordHash: string;
    verificationTokenHash: string;
    verificationExpiresAt: Date;
  }): Promise<void> {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const [user] = await User.create([{
          name: data.input.ownerName,
          email: data.input.email,
          passwordHash: data.passwordHash,
          emailVerificationTokenHash: data.verificationTokenHash,
          emailVerificationExpiresAt: data.verificationExpiresAt
        }], { session });
        if (!user) throw new Error('Failed to create signup user.');
        const [tenant] = await Tenant.create([{
          name: data.input.shopName,
          slug: data.input.slug,
          status: 'pending',
          ownerUserId: user._id,
          branding: { displayName: data.input.shopName }
        }], { session });
        if (!tenant) throw new Error('Failed to create signup tenant.');
        await TenantMembership.create([{
          tenantId: tenant._id,
          userId: user._id,
          role: 'owner',
          status: 'pending_approval'
        }], { session });
        await SignupRequest.create([{
          tenantId: tenant._id,
          ownerUserId: user._id,
          shopName: data.input.shopName,
          requestedSlug: data.input.slug,
          ownerName: data.input.ownerName,
          email: data.input.email,
          phone: data.input.phone,
          requestedPlanId: data.input.requestedPlanId || null,
          status: 'pending'
        }], { session });
      });
    } finally {
      await session.endSession();
    }
  }

}

export const registerOwner = async (
  input: RegisterInput,
  store: RegistrationStore,
  mailer: VerificationMailer,
  now = new Date()
): Promise<void> => {
  if (input.requestedPlanId && !mongoose.isValidObjectId(input.requestedPlanId)) {
    throw new HttpError(400, 'The requested plan is invalid.', 'INVALID_PLAN');
  }
  if (input.requestedPlanId) {
    const planExists = await Plan.exists({ _id: input.requestedPlanId, active: true });
    if (!planExists) throw new HttpError(400, 'The requested plan is unavailable.', 'INVALID_PLAN');
  }

  const rawToken = randomBytes(32).toString('base64url');
  const passwordHash = await bcrypt.hash(input.password, 12);
  await store.createPendingApplication({
    input,
    passwordHash,
    verificationTokenHash: hashVerificationToken(rawToken),
    verificationExpiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000)
  });
  try {
    await mailer.sendVerificationEmail(input.email, input.ownerName, rawToken);
  } catch {
    throw new HttpError(
      503,
      'Your application was saved, but verification email delivery failed. Retry verification later.',
      'VERIFICATION_EMAIL_UNAVAILABLE'
    );
  }
}

export interface ApprovalStore {
  approveApplication(input: {
    requestId: string;
    reviewerId: string;
    planId: string;
    trialDays?: number;
  }): Promise<void>;
  rejectApplication(input: {
    requestId: string;
    reviewerId: string;
    reason: string;
  }): Promise<void>;
}

export class MongooseApprovalStore implements ApprovalStore {
  async approveApplication(input: {
    requestId: string;
    reviewerId: string;
    planId: string;
    trialDays?: number;
  }): Promise<void> {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const application = await SignupRequest.findOne({
          _id: input.requestId,
          status: 'pending'
        }).session(session);
        if (!application) {
          throw new HttpError(404, 'Pending application not found.', 'APPLICATION_NOT_FOUND');
        }
        const owner = await User.findById(application.ownerUserId).session(session);
        if (!owner?.emailVerifiedAt) {
          throw new HttpError(409, 'The owner must verify their email before approval.', 'EMAIL_NOT_VERIFIED');
        }
        const plan = await Plan.findOne({ _id: input.planId, active: true }).session(session);
        if (!plan) throw new HttpError(400, 'The selected plan is unavailable.', 'INVALID_PLAN');
        const tenant = await Tenant.findById(application.tenantId).session(session);
        if (!tenant) throw new HttpError(404, 'Shop not found.', 'TENANT_NOT_FOUND');
        const transition = prepareApplicationApproval({
          applicationStatus: application.status,
          tenantStatus: tenant.status,
          ownerEmailVerified: Boolean(owner.emailVerifiedAt),
          planActive: true,
          trialDays: input.trialDays ?? plan.trialDays
        });

        tenant.status = transition.tenantStatus;
        tenant.planId = plan._id;
        tenant.approvedAt = transition.periodStart;
        tenant.approvedBy = new mongoose.Types.ObjectId(input.reviewerId);
        tenant.limits = plan.limits || {
          staff: 1,
          branches: 1,
          products: 1000,
          storageBytes: 1073741824
        };
        await tenant.save({ session });
        const membershipResult = await TenantMembership.updateOne(
          { tenantId: tenant._id, userId: owner._id, status: 'pending_approval' },
          { status: transition.membershipStatus },
          { session }
        );
        if (membershipResult.matchedCount !== 1) {
          throw new HttpError(409, 'The owner membership is no longer pending.', 'MEMBERSHIP_NOT_PENDING');
        }
        await Subscription.create([{
          tenantId: tenant._id,
          planId: plan._id,
          provider: 'manual',
          status: transition.subscriptionStatus,
          billingInterval: 'month',
          currentPeriodStart: transition.periodStart,
          currentPeriodEnd: transition.periodEnd,
          trialEnd: transition.trialEnd
        }], { session });
        application.status = 'approved';
        application.requestedPlanId = plan._id;
        application.reviewedBy = new mongoose.Types.ObjectId(input.reviewerId);
        application.reviewedAt = transition.periodStart;
        await application.save({ session });
        await AuditLog.create([{
          actorUserId: new mongoose.Types.ObjectId(input.reviewerId),
          tenantId: tenant._id,
          action: 'tenant.application.approved',
          targetType: 'tenant',
          targetId: String(tenant._id),
          metadata: { planId: String(plan._id), trialDays: transition.trialDays }
        }], { session });
      });
    } finally {
      await session.endSession();
    }
  }

  async rejectApplication(input: {
    requestId: string;
    reviewerId: string;
    reason: string;
  }): Promise<void> {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const application = await SignupRequest.findOne({
          _id: input.requestId,
          status: 'pending'
        }).session(session);
        if (!application) {
          throw new HttpError(404, 'Pending application not found.', 'APPLICATION_NOT_FOUND');
        }
        const tenantResult = await Tenant.updateOne(
          { _id: application.tenantId, status: 'pending' },
          { status: 'rejected' },
          { session }
        );
        if (tenantResult.matchedCount !== 1) {
          throw new HttpError(409, 'Application is no longer pending.', 'APPLICATION_NOT_PENDING');
        }
        application.status = 'rejected';
        application.reviewedBy = new mongoose.Types.ObjectId(input.reviewerId);
        application.reviewedAt = new Date();
        application.rejectionReason = input.reason;
        await application.save({ session });
        await AuditLog.create([{
          actorUserId: new mongoose.Types.ObjectId(input.reviewerId),
          tenantId: application.tenantId,
          action: 'tenant.application.rejected',
          targetType: 'tenant',
          targetId: String(application.tenantId),
          metadata: { reason: input.reason }
        }], { session });
      });
    } finally {
      await session.endSession();
    }
  }
}
