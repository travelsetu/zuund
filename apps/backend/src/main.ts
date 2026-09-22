import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import type { Env } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService<Env, true>);

  app.setGlobalPrefix('api');
  // Behind nginx: trust X-Forwarded-* from the first hop so `secure` cookies and
  // client IPs are computed from the original request.
  app.set('trust proxy', 1);
  app.use(cookieParser());
  app.enableCors({
    origin: config.get('CORS_ORIGIN', { infer: true }),
    credentials: true,
  });
  app.enableShutdownHooks();

  const port = config.get('PORT', { infer: true });
  const host = config.get('HOST', { infer: true });
  await app.listen(port, host);
  Logger.log(`API listening on http://${host}:${port}/api`, 'Bootstrap');

  // Tells pm2 (cluster mode, wait_ready) this instance can take traffic, so a
  // rolling reload never routes to a worker that is still connecting to Postgres.
  // Outside pm2 there is no IPC channel and process.send is undefined.
  process.send?.('ready');
}

void bootstrap();
