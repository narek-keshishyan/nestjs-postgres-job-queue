import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  NotFoundException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JobsService, CreateJobDto } from './jobs.service';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateJobDto) {
    const job = await this.jobsService.createJob(dto);
    return { message: 'Job enqueued', job };
  }

  @Get()
  async list(
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const jobs = await this.jobsService.listJobs(
      status,
      limit ? parseInt(limit, 10) : undefined,
      offset ? parseInt(offset, 10) : undefined,
    );
    return { count: jobs.length, jobs };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const job = await this.jobsService.getJob(id);
    if (!job) {
      throw new NotFoundException(`Job ${id} not found`);
    }
    return { job };
  }
}
