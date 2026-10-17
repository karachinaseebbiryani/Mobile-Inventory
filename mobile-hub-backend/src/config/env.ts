import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  PLATFORM_MONGO_URI: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().regex(/^\d+[smhd]$/).default('15m'),
  WEB_ORIGINS: z.string().default('http://localhost:3000'),
  EMAIL_FROM: z.string().email().or(z.string().includes('<')),
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASSWORD: z.string().optional().default(''),
  SMTP_FROM: z.string().optional().default(''),
  SMTP_USE_TLS: z.enum(['true', 'false']).default('true').transform(value => value === 'true'),
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
  if (result.data.NODE_ENV === 'production' &&
      (!result.data.SMTP_HOST || !result.data.SMTP_USER || !result.data.SMTP_PASSWORD)) {
    throw new Error('SMTP_HOST, SMTP_USER, and SMTP_PASSWORD are required in production.');
  }
  if (result.data.NODE_ENV === 'production' && !result.data.SMTP_USE_TLS) {
    throw new Error('SMTP_USE_TLS must be true in production.');
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
