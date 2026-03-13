import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

@Injectable()
export class PostgresService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PostgresService.name);
  private pool: Pool;

  async onModuleInit(): Promise<void> {
    this.pool = new Pool({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
      user: process.env.POSTGRES_USER || 'jobqueue',
      password: process.env.POSTGRES_PASSWORD || 'jobqueue_secret',
      database: process.env.POSTGRES_DB || 'jobqueue',
      max: 10,
    });

    await this.ensureSchema();
    this.logger.log('PostgreSQL connection pool initialised');
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
    this.logger.log('PostgreSQL connection pool closed');
  }

  async query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  private async ensureSchema(): Promise<void> {
    const createTable = `
      CREATE TABLE IF NOT EXISTS jobs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        type TEXT NOT NULL,
        payload JSONB NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        attempts INT NOT NULL DEFAULT 0,
        max_attempts INT NOT NULL DEFAULT 3,
        available_at TIMESTAMP NOT NULL DEFAULT NOW(),
        processed_at TIMESTAMP,
        failed_at TIMESTAMP,
        error_message TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `;
    const createIndex = `
      CREATE INDEX IF NOT EXISTS idx_jobs_status_available ON jobs (status, available_at);
    `;

    await this.pool.query(createTable);
    await this.pool.query(createIndex);
    this.logger.log('Database schema verified');
  }
}
