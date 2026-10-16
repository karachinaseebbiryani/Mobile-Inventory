import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import {
  MongooseRegistrationStore,
  hashVerificationToken,
  registerOwner,
  type RegistrationStore
} from '../services/signup';
import type { VerificationMailer } from '../services/email';
import { SignupRequest } from '../models/SignupRequest';
import { TenantMembership } from '../models/TenantMembership';
import { Tenant } from '../models/Tenant';
import { User } from '../models/User';
import { requireAuth } from '../middleware/auth';
import { asyncHandler, HttpError } from '../utils/http';

const reservedSlugs = new Set(['admin', 'api', 'app', 'billing', 'help', 'login', 'signup', 'www']);
const passwordSchema = z.string()
  .min(12)
  .max(72)
  .refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be at most 72 bytes.');

const registerSchema = z.object({
  shopName: z.string().trim().min(2).max(120),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/),
  ownerName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
  password: passwordSchema,
  phone: z.string().trim().max(40).default(''),
  requestedPlanId: z.string().optional()
}).strict().refine(input => !reservedSlugs.has(input.slug), {
  path: ['slug'],
  message: 'This shop URL is reserved.'
});

const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
  password: z.string().min(1).max(72)
}).strict();

const verifySchema = z.object({ token: z.string().min(30).max(200) }).strict();

export const createAuthRouter = (
  mailer: VerificationMailer,
  registrationStore: RegistrationStore = new MongooseRegistrationStore()
): Router => {
  const router = Router();

  router.post('/register', asyncHandler(async (request, response) => {
    const input = registerSchema.parse(request.body);
    await registerOwner(input, registrationStore, mailer);
    response.status(202).json({
      message: 'Application received. Verify your email to continue; a super administrator must approve your shop.'
    });
  }));

  router.post('/verify-email', asyncHandler(async (request, response) => {
    const { token } = verifySchema.parse(request.body);
    const tokenHash = hashVerificationToken(token);
    const user = await User.findOne({
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpiresAt: { $gt: new Date() }
    }).select('+emailVerificationTokenHash +emailVerificationExpiresAt');
    if (!user) throw new HttpError(400, 'Verification token is invalid or expired.', 'INVALID_VERIFICATION_TOKEN');
    user.emailVerifiedAt = new Date();
    user.set('emailVerificationTokenHash', undefined);
    user.set('emailVerificationExpiresAt', undefined);
    await user.save();
    response.json({ message: 'Email verified. You may now sign in.' });
  }));

  router.post('/resend-verification', asyncHandler(async (request, response) => {
    const body = z.object({
      email: z.string().trim().email().max(254).transform(value => value.toLowerCase())
    }).strict().parse(request.body);
    const user = await User.findOne({ email: body.email })
      .select('+emailVerificationTokenHash +emailVerificationExpiresAt');
    if (user && user.active && !user.emailVerifiedAt) {
      const token = randomBytes(32).toString('base64url');
      user.set('emailVerificationTokenHash', createHash('sha256').update(token).digest('hex'));
      user.set('emailVerificationExpiresAt', new Date(Date.now() + 24 * 60 * 60 * 1000));
      await user.save();
      await mailer.sendVerificationEmail(user.email, user.name, token);
    }
    response.status(202).json({ message: 'If verification is needed, an email will be sent.' });
  }));

  router.post('/login', asyncHandler(async (request, response) => {
    const credentials = loginSchema.parse(request.body);
    const user = await User.findOne({ email: credentials.email }).select('+passwordHash');
    if (!user || !user.active || !(await bcrypt.compare(credentials.password, user.passwordHash))) {
      throw new HttpError(401, 'Email or password is incorrect.', 'INVALID_CREDENTIALS');
    }
    if (!user.emailVerifiedAt) {
      throw new HttpError(403, 'Verify your email before signing in.', 'EMAIL_NOT_VERIFIED');
    }

    const expiresIn = request.app.locals.env.JWT_EXPIRES_IN as SignOptions['expiresIn'];
    const accessToken = jwt.sign(
      { platformRole: user.platformRole },
      request.app.locals.env.JWT_SECRET,
      { subject: String(user._id), expiresIn }
    );
    const memberships = await TenantMembership.find({ userId: user._id }).lean();
    const shops = await Promise.all(memberships.map(async membership => {
      const tenant = await Tenant.findById(membership.tenantId).select('name slug status').lean();
      if (!tenant) return null;
      return {
        id: String(tenant._id),
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        role: membership.role,
        membershipStatus: membership.status
      };
    }));
    response.json({
      accessToken,
      tokenType: 'Bearer',
      expiresIn: request.app.locals.env.JWT_EXPIRES_IN,
      user: { id: String(user._id), name: user.name, email: user.email, platformRole: user.platformRole },
      shops: shops.filter((shop): shop is NonNullable<typeof shop> => shop !== null)
    });
  }));

  router.get('/me', requireAuth, asyncHandler(async (request, response) => {
    const user = await User.findById(request.auth?.userId).select('name email platformRole emailVerifiedAt');
    if (!user) throw new HttpError(401, 'Authentication is no longer valid.', 'INVALID_TOKEN');
    const applications = await SignupRequest.find({ ownerUserId: user._id })
      .select('tenantId status reviewedAt rejectionReason createdAt')
      .sort({ createdAt: -1 })
      .lean();
    response.json({
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
        platformRole: user.platformRole,
        emailVerified: Boolean(user.emailVerifiedAt)
      },
      applications: applications.map(application => ({
        id: String(application._id),
        status: application.status,
        reviewedAt: application.reviewedAt,
        rejectionReason: application.rejectionReason,
        tenantId: String(application.tenantId)
      }))
    });
  }));

  return router;
};
