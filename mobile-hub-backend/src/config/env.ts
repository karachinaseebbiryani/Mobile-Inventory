import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  PLATFORM_MONGO_URI: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().regex(/^\d+[smhd]$/).default('15m'),
  WEB_ORIGINS: z.string().default('http://localhost:3000'),
  EMAIL_FROM: z.string().email().or(z.string().includes('<')),
  RESEND_API_KEY: z.string().optional().default(''),
});

export type AppEnv = z.infer<typeof envSchema>;

export const loadEnv = (source: NodeJS.ProcessEnv = process.env): AppEnv => {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues
      .map(issue => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  if (result.data.NODE_ENV === 'production' && !result.data.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is required in production.');
  }
  const origins = result.data.WEB_ORIGINS.split(',').map(origin => origin.trim());
  if (origins.some(origin => !origin || origin === '*')) {
    throw new Error('WEB_ORIGINS must contain explicit origins and cannot use a wildcard.');
  }
  for (const origin of origins) {
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error('WEB_ORIGINS must contain valid absolute URLs.');
    }
    if (!['http:', 'https:'].includes(parsed.protocol) ||
        (result.data.NODE_ENV === 'production' && parsed.protocol !== 'https:')) {
      throw new Error('WEB_ORIGINS must use HTTPS in production.');
    }
  }
  return result.data;
};
