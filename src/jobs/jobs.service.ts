import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { PostgresService } from '../database/postgres.service';

export interface Job {
  id: string;
  type: string;
  payload: Record<string, any>;
  status: string;
  attempts: number;
  max_attempts: number;
  available_at: Date;
  processed_at: Date | null;
  failed_at: Date | null;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateJobDto {
  type: string;
  payload: Record<string, any>;
  max_attempts?: number;
  available_at?: string;
}

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(private readonly postgres: PostgresService) {}

  async createJob(dto: CreateJobDto): Promise<Job> {
    const id = uuidv4();
    const maxAttempts = dto.max_attempts ?? 3;
    const availableAt = dto.available_at ?? new Date().toISOString();

    const { rows } = await this.postgres.query<Job>(
      `INSERT INTO jobs (id, type, payload, max_attempts, available_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, dto.type, JSON.stringify(dto.payload), maxAttempts, availableAt],
    );

    this.logger.log(`Job created: ${rows[0].id} [${dto.type}]`);
    return rows[0];
  }

  async getJob(id: string): Promise<Job | null> {
    const { rows } = await this.postgres.query<Job>(
      'SELECT * FROM jobs WHERE id = $1',
      [id],
    );
    return rows[0] ?? null;
  }

  async listJobs(status?: string, limit = 50, offset = 0): Promise<Job[]> {
    if (status) {
      const { rows } = await this.postgres.query<Job>(
        'SELECT * FROM jobs WHERE status = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
        [status, limit, offset],
      );
      return rows;
    }

    const { rows } = await this.postgres.query<Job>(
      'SELECT * FROM jobs ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset],
    );
    return rows;
  }
}
