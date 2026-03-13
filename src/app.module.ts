import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { JobsModule } from './jobs/jobs.module';

@Module({
  imports: [DatabaseModule, JobsModule],
})
export class AppModule {}
