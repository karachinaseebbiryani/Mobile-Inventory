import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import type { AppEnv } from './config/env';
import type { VerificationMailer } from './services/email';
import { createAuthRouter } from './routes/auth';
import type { RegistrationStore } from './services/signup';
import { createAdminRouter } from './routes/admin';
import { createShopRouter } from './routes/shop';
import { createPublicRouter } from './routes/public';
import { errorHandler } from './utils/http';

export interface AppDependencies {
  mailer: VerificationMailer;
  registrationStore?: RegistrationStore;
}

export const createApp = (env: AppEnv, dependencies: AppDependencies): Express => {
  const app = express();
  app.locals.env = env;
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use((request, response, next) => {
    request.requestId = randomUUID();
    response.setHeader('X-Request-Id', request.requestId);
    next();
  });
  app.use(helmet());
  app.use(cors({
    origin: env.WEB_ORIGINS.split(',').map(origin => origin.trim()),
    credentials: true
  }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/health/live', (_request, response) => response.json({ status: 'ok' }));
  app.get('/health/ready', (_request, response) => {
    const ready = mongoose.connection.readyState === 1;
    response.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready' });
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-7',
    legacyHeaders: false
  });
  app.use('/api/v1/auth', authLimiter, createAuthRouter(dependencies.mailer, dependencies.registrationStore));
  app.use('/api/v1/admin', createAdminRouter());
  app.use('/api/v1/shop', createShopRouter());
  app.use('/api/v1/public', createPublicRouter());

  app.use((_request, response) => {
    response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found.' } });
  });
  app.use(errorHandler);

  return app;
};
