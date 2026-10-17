import 'dotenv/config';
import http from 'node:http';
import mongoose from 'mongoose';
import { createApp } from './app';
import { loadEnv } from './config/env';
import { SmtpVerificationMailer } from './services/email';

const start = async (): Promise<void> => {
  const env = loadEnv();
  await mongoose.connect(env.PLATFORM_MONGO_URI, {
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 10000,
    autoIndex: env.NODE_ENV !== 'production'
  });

  const app = createApp(env, { mailer: new SmtpVerificationMailer(env) });
  const server = http.createServer(app);
  server.listen(env.PORT, '0.0.0.0', () => {
    console.log(`SaaS API listening on port ${env.PORT}`);
  });

  const shutdown = (signal: string): void => {
    console.log(`Received ${signal}; shutting down SaaS API.`);
    server.close(error => {
      if (error) {
        console.error('HTTP server shutdown failed:', error.name);
        process.exitCode = 1;
      }
      void mongoose.disconnect().catch(disconnectError => {
        console.error('MongoDB shutdown failed:', disconnectError instanceof Error ? disconnectError.name : 'UnknownError');
        process.exitCode = 1;
      });
    });
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
};

void start().catch(error => {
  console.error('SaaS API startup failed:', error instanceof Error ? error.name : 'UnknownError');
  process.exitCode = 1;
});
