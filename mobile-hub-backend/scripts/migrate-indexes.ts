import 'dotenv/config';
import mongoose from 'mongoose';
import { loadEnv } from '../src/config/env';
import { AuditLog } from '../src/models/AuditLog';
import { DomainMapping } from '../src/models/DomainMapping';
import { Plan } from '../src/models/Plan';
import { Product } from '../src/models/Product';
import { SignupRequest } from '../src/models/SignupRequest';
import { Subscription } from '../src/models/Subscription';
import { Tenant } from '../src/models/Tenant';
import { TenantMembership } from '../src/models/TenantMembership';
import { User } from '../src/models/User';

let phase = 'loading environment';

const safeErrorMessage = (error: unknown): string => {
  if (!(error instanceof Error)) return 'An unknown error occurred.';
  return error.message
    .replace(/mongodb(?:\+srv)?:\/\/[^\s"'<>]+/gi, 'mongodb://[REDACTED]')
    .replace(/\b(password|passwd|pwd|token|secret)=([^\s&]+)/gi, '$1=[REDACTED]');
};

const run = async (): Promise<void> => {
  const env = loadEnv();
  phase = 'connecting to platform MongoDB';
  await mongoose.connect(env.PLATFORM_MONGO_URI, { autoIndex: false });
  try {
    const models = [
      User,
      Tenant,
      TenantMembership,
      SignupRequest,
      Plan,
      Subscription,
      Product,
      AuditLog,
      DomainMapping
    ];
    for (const model of models) {
      phase = `creating indexes for ${model.modelName}`;
      await model.createIndexes();
      console.log(`Indexes ensured: ${model.modelName}`);
    }
    phase = 'completed';
  } finally {
    await mongoose.disconnect();
  }
};

void run().catch(error => {
  console.error(
    `Platform index migration failed while ${phase} (${error instanceof Error ? error.name : 'UnknownError'}):`,
    safeErrorMessage(error)
  );
  process.exitCode = 1;
});
