import type { AppEnv } from '../config/env';
import type { Types } from 'mongoose';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      auth?: {
        userId: string;
        platformRole: 'super_admin' | 'user';
      };
      tenantContext?: {
        tenantId: Types.ObjectId;
        userId: Types.ObjectId;
        tenant: {
          _id: Types.ObjectId;
          status: string;
          planId?: Types.ObjectId | null;
          featureOverrides?: Record<string, boolean | null | undefined>;
        };
        membership: {
          role: string;
          permissions: string[];
        };
        entitlements?: Record<string, boolean>;
      };
    }

    interface Locals {
      env: AppEnv;
    }
  }
}

export {};
