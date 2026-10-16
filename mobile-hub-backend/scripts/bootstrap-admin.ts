import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { z } from 'zod';
import { loadEnv } from '../src/config/env';
import { User } from '../src/models/User';

const bootstrapSchema = z.object({
  BOOTSTRAP_SUPER_ADMIN_EMAIL: z.string().email(),
  BOOTSTRAP_SUPER_ADMIN_NAME: z.string().min(2).max(120),
  BOOTSTRAP_SUPER_ADMIN_PASSWORD: z.string()
    .min(16)
    .max(72)
    .refine(value => Buffer.byteLength(value, 'utf8') <= 72)
});

const run = async (): Promise<void> => {
  const env = loadEnv();
  const bootstrap = bootstrapSchema.parse(process.env);
  await mongoose.connect(env.PLATFORM_MONGO_URI);
  try {
    if (await User.exists({ platformRole: 'super_admin' })) {
      throw new Error('A super administrator already exists; bootstrap is disabled.');
    }
    const email = bootstrap.BOOTSTRAP_SUPER_ADMIN_EMAIL.toLowerCase();
    if (await User.exists({ email })) {
      throw new Error('That email already belongs to a user; bootstrap will not promote it.');
    }
    const passwordHash = await bcrypt.hash(bootstrap.BOOTSTRAP_SUPER_ADMIN_PASSWORD, 12);
    await User.create({
      name: bootstrap.BOOTSTRAP_SUPER_ADMIN_NAME,
      email,
      passwordHash,
      platformRole: 'super_admin',
      active: true,
      emailVerifiedAt: new Date()
    });
    console.log(`Created initial super administrator: ${email}`);
  } finally {
    await mongoose.disconnect();
  }
};

void run().catch(error => {
  console.error('Super administrator bootstrap failed:', error instanceof Error ? error.message : 'UnknownError');
  process.exitCode = 1;
});
