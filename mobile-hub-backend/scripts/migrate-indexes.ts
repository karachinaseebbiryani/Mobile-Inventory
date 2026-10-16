import 'dotenv/config';
import mongoose from 'mongoose';
import { loadEnv } from '../src/config/env';
import { AuditLog } from '../src/models/AuditLog';
import { DomainMapping } from '../src/models/DomainMapping';
import { Plan } from '../src/models/Plan';
import { SignupRequest } from '../src/models/SignupRequest';
import { Subscription } from '../src/models/Subscription';
import { Tenant } from '../src/models/Tenant';
import { TenantMembership } from '../src/models/TenantMembership';
import { User } from '../src/models/User';

const run = async (): Promise<void> => {
  const env = loadEnv();
  await mongoose.connect(env.PLATFORM_MONGO_URI, { autoIndex: false });
  try {
    const models = [User, Tenant, TenantMembership, SignupRequest, Plan, Subscription, AuditLog, DomainMapping];
    for (const model of models) {
      await model.createIndexes();
      console.log(`Indexes ensured: ${model.modelName}`);
    }
  } finally {
    await mongoose.disconnect();
  }
};

void run().catch(error => {
  console.error('Platform index migration failed:', error instanceof Error ? error.name : 'UnknownError');
  process.exitCode = 1;
});
