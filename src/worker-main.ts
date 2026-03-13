import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { WorkerModule } from './worker/worker.module';

@Module({
  imports: [DatabaseModule, WorkerModule],
})
class WorkerAppModule {}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerAppModule);
  console.log('Worker process started');

  const shutdown = async () => {
    console.log('Shutting down worker…');
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap();
