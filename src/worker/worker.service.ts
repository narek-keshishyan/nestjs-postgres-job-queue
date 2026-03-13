import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PostgresService } from '../database/postgres.service';
import { Job } from '../jobs/jobs.service';

@Injectable()
export class WorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerService.name);
  private intervalRef: ReturnType<typeof setInterval> | null = null;
  private processing = false;

  constructor(private readonly postgres: PostgresService) {}

  onModuleInit(): void {
    const pollMs = parseInt(process.env.WORKER_POLL_INTERVAL_MS || '3000', 10);
    this.logger.log(`Worker starting — polling every ${pollMs}ms`);
    this.intervalRef = setInterval(() => this.poll(), pollMs);
  }

  onModuleDestroy(): void {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
    }
    this.logger.log('Worker stopped');
  }

  private async poll(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    try {
      const job = await this.dequeueJob();
      if (job) {
        await this.processJob(job);
      }
    } catch (err) {
      this.logger.error('Poll error', (err as Error).stack);
    } finally {
      this.processing = false;
    }
  }

  private async dequeueJob(): Promise<Job | null> {
    const { rows } = await this.postgres.query<Job>(
      `UPDATE jobs
       SET status = 'processing',
           attempts = attempts + 1,
           updated_at = NOW()
       WHERE id = (
         SELECT id FROM jobs
         WHERE status = 'pending'
           AND available_at <= NOW()
         ORDER BY available_at ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING *`,
    );
    return rows[0] ?? null;
  }

  private async processJob(job: Job): Promise<void> {
    this.logger.log(`Processing job ${job.id} [${job.type}] attempt ${job.attempts}/${job.max_attempts}`);

    try {
      await this.handleJob(job);

      await this.postgres.query(
        `UPDATE jobs
         SET status = 'completed',
             processed_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [job.id],
      );
      this.logger.log(`Job ${job.id} completed`);
    } catch (err) {
      const errorMessage = (err as Error).message;
      this.logger.error(`Job ${job.id} failed: ${errorMessage}`);

      if (job.attempts >= job.max_attempts) {
        await this.postgres.query(
          `UPDATE jobs
           SET status = 'failed',
               failed_at = NOW(),
               error_message = $2,
               updated_at = NOW()
           WHERE id = $1`,
          [job.id, errorMessage],
        );
        this.logger.warn(`Job ${job.id} permanently failed after ${job.attempts} attempts`);
      } else {
        await this.postgres.query(
          `UPDATE jobs
           SET status = 'pending',
               error_message = $2,
               available_at = NOW() + INTERVAL '10 seconds',
               updated_at = NOW()
           WHERE id = $1`,
          [job.id, errorMessage],
        );
        this.logger.log(`Job ${job.id} re-queued for retry`);
      }
    }
  }

  private async handleJob(job: Job): Promise<void> {
    switch (job.type) {
      case 'send_email':
        this.logger.log(`Simulating email to ${(job.payload as any).to}`);
        await this.sleep(500);
        break;
      case 'generate_report':
        this.logger.log(`Simulating report generation: ${(job.payload as any).reportName}`);
        await this.sleep(1000);
        break;
      case 'failing_job':
        throw new Error('Simulated failure for testing retry logic');
      default:
        this.logger.log(`Processing generic job type: ${job.type}`);
        await this.sleep(300);
        break;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
