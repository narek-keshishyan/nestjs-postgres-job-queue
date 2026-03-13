# nestjs-postgres-job-queue

A production-style background job queue built with **NestJS**, **TypeScript**, **PostgreSQL**, and **Docker**.

---

## Architecture

```
┌──────────────┐         ┌──────────────────┐         ┌──────────────┐
│   Client     │  HTTP   │   API Server     │  SQL    │  PostgreSQL  │
│  (curl/app)  │───────▶│  (NestJS REST)   │───────▶│   (jobs)     │
└──────────────┘         └──────────────────┘         └──────┬───────┘
                                                             │
                                                             │ poll
                                                             ▼
                                                      ┌──────────────┐
                                                      │   Worker     │
                                                      │  (polling)   │
                                                      └──────────────┘
```

### Flow

1. **Client** sends a `POST /jobs` request to the API.
2. **API** inserts a new row into the `jobs` table with status `pending`.
3. **Worker** polls the database every few seconds.
4. Worker atomically locks a pending job using `SELECT … FOR UPDATE SKIP LOCKED`.
5. Worker processes the job:
   - **Success** → status set to `completed`, `processed_at` recorded.
   - **Failure** → if `attempts < max_attempts`, status reset to `pending` with a back-off delay; otherwise status set to `failed`.

### Job Statuses

| Status       | Description                                    |
|-------------|------------------------------------------------|
| `pending`   | Waiting to be picked up by a worker            |
| `processing`| Currently being processed                      |
| `completed` | Successfully processed                         |
| `failed`    | Permanently failed after exhausting retries    |

---

## Project Structure

```
src/
  main.ts                  # API entry point
  worker-main.ts           # Worker entry point
  app.module.ts            # API root module
  database/
    database.module.ts     # Global database module
    postgres.service.ts    # PostgreSQL connection pool & schema
  jobs/
    jobs.module.ts         # Jobs feature module
    jobs.controller.ts     # REST endpoints for jobs
    jobs.service.ts        # Job creation & querying logic
  worker/
    worker.module.ts       # Worker feature module
    worker.service.ts      # Polling, locking, processing, retry logic
scripts/
  init.sql                 # Database schema (used by docker-compose)
  start-api.sh             # Convenience script to run the API locally
  start-worker.sh          # Convenience script to run the worker locally
```

---

## Quick Start (Docker)

```bash
# Start PostgreSQL, API, and Worker
docker-compose up --build

# The API will be available at http://localhost:3000
```

## Local Development (without Docker)

### Prerequisites

- Node.js ≥ 18
- PostgreSQL running locally (or via `docker-compose up postgres`)

### Setup

```bash
# Install dependencies
npm install

# Copy and adjust environment variables
cp .env.example .env

# Start PostgreSQL only (optional — if you don't have a local instance)
docker-compose up -d postgres

# Start the API server
npm run start:dev

# In a separate terminal, start the worker
npm run start:worker:dev
```

---

## Database Schema

```sql
CREATE TABLE jobs (
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
```

The schema is automatically created on application startup and also provided in `scripts/init.sql` for the Docker PostgreSQL container.

---

## API Endpoints

### Create a Job

```
POST /jobs
Content-Type: application/json
```

**Body:**

| Field          | Type   | Required | Description                        |
|---------------|--------|----------|------------------------------------|
| `type`        | string | yes      | Job type identifier                |
| `payload`     | object | yes      | Arbitrary JSON payload             |
| `max_attempts`| number | no       | Max retry attempts (default: 3)    |
| `available_at`| string | no       | ISO timestamp for delayed jobs     |

### List Jobs

```
GET /jobs?status=pending&limit=50&offset=0
```

### Get a Job by ID

```
GET /jobs/:id
```

---

## Example curl Requests

### Enqueue an email job

```bash
curl -X POST http://localhost:3000/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "type": "send_email",
    "payload": {
      "to": "user@example.com",
      "subject": "Welcome!",
      "body": "Thanks for signing up."
    }
  }'
```

### Enqueue a report generation job

```bash
curl -X POST http://localhost:3000/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "type": "generate_report",
    "payload": {
      "reportName": "monthly-sales",
      "month": "2026-03"
    }
  }'
```

### Enqueue a job that will fail (to test retry logic)

```bash
curl -X POST http://localhost:3000/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "type": "failing_job",
    "payload": { "reason": "testing retries" },
    "max_attempts": 3
  }'
```

### Enqueue a delayed job (available in 60 seconds)

```bash
curl -X POST http://localhost:3000/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "type": "send_email",
    "payload": { "to": "delayed@example.com", "subject": "Delayed" },
    "available_at": "2026-03-13T16:30:00.000Z"
  }'
```

### List all jobs

```bash
curl http://localhost:3000/jobs
```

### List only pending jobs

```bash
curl "http://localhost:3000/jobs?status=pending"
```

### Get a specific job by ID

```bash
curl http://localhost:3000/jobs/<JOB_UUID>
```

---

## Scripts

| Script                    | Description                          |
|--------------------------|--------------------------------------|
| `npm run start`          | Start API (compiled)                 |
| `npm run start:dev`      | Start API in watch mode              |
| `npm run start:prod`     | Start API from `dist/`               |
| `npm run start:worker`   | Start worker from `dist/`            |
| `npm run start:worker:dev`| Start worker with `ts-node`         |
| `npm run build`          | Compile TypeScript                   |
| `./scripts/start-api.sh` | Shell script to run API via ts-node  |
| `./scripts/start-worker.sh`| Shell script to run worker via ts-node |

---

## Environment Variables

| Variable                  | Default           | Description                      |
|--------------------------|-------------------|----------------------------------|
| `POSTGRES_HOST`          | `localhost`       | PostgreSQL host                  |
| `POSTGRES_PORT`          | `5432`            | PostgreSQL port                  |
| `POSTGRES_USER`          | `jobqueue`        | PostgreSQL user                  |
| `POSTGRES_PASSWORD`      | `jobqueue_secret` | PostgreSQL password              |
| `POSTGRES_DB`            | `jobqueue`        | PostgreSQL database name         |
| `API_PORT`               | `3000`            | Port for the REST API            |
| `WORKER_POLL_INTERVAL_MS`| `3000`            | Worker polling interval (ms)     |

---

## License

MIT
