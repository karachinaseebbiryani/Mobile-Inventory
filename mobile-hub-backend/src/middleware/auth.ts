import jwt, { type JwtPayload } from 'jsonwebtoken';
import type { RequestHandler } from 'express';
import { User } from '../models/User';
import { HttpError } from '../utils/http';

interface AccessClaims extends JwtPayload {
  sub: string;
  platformRole: 'super_admin' | 'user';
}

const bearerToken = (authorization: string | undefined): string | null => {
  if (!authorization) return null;
  const match = /^Bearer ([^\s]+)$/.exec(authorization);
  return match?.[1] ?? null;
};

export const requireAuth: RequestHandler = async (request, _response, next) => {
  try {
    const token = bearerToken(request.header('authorization'));
    if (!token) throw new HttpError(401, 'Authentication is required.', 'UNAUTHENTICATED');
    const payload = jwt.verify(token, request.app.locals.env.JWT_SECRET);
    if (typeof payload === 'string' || typeof payload.sub !== 'string') {
      throw new HttpError(401, 'Authentication token is invalid.', 'INVALID_TOKEN');
    }
    const claims = payload as AccessClaims;
    const user = await User.findById(claims.sub).select('platformRole active emailVerifiedAt');
    if (!user || !user.active) {
      throw new HttpError(401, 'Authentication is no longer valid.', 'INVALID_TOKEN');
    }
    if (!user.emailVerifiedAt) {
      throw new HttpError(403, 'Verify your email before signing in.', 'EMAIL_NOT_VERIFIED');
    }
    request.auth = { userId: String(user._id), platformRole: user.platformRole };
    next();
  } catch (error) {
    next(error);
  }
};

export const requireSuperAdmin: RequestHandler = (request, _response, next) => {
  if (request.auth?.platformRole !== 'super_admin') {
    next(new HttpError(403, 'Super administrator access is required.', 'FORBIDDEN'));
    return;
  }
  next();
};
