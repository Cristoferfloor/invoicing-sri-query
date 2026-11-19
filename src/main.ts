import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { ErroresFilter } from './infrastructure/rest/errores.filter';

async function bootstrap() {
  try {
    process.loadEnvFile();
  } catch {
    // sin .env: se usan las variables del entorno
  }

  const app = await NestFactory.create(AppModule.registrar(process.env));
  app.enableShutdownHooks();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new ErroresFilter());

  const puerto = Number(process.env.SRI_QUERY_PORT ?? 3005);
  await app.listen(puerto, '0.0.0.0');

  new Logger('Bootstrap').log(`sri-query-service escuchando en :${puerto}`);
}

void bootstrap();
