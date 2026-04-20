# ChoreMate

> Making household chores collaborative, fair, and actually enjoyable for shared living spaces.

ChoreMate is a production-grade, full-stack web application. It auto-generates personalised chore schedules based on roommate preferences, tracks completion fairness, handles swap requests, and provides an AI chatbot powered by Google Gemini — all deployed on AWS via Terraform.

---

## Table of Contents

- [ChoreMate](#choremate)
  - [Table of Contents](#table-of-contents)
  - [Architecture Overview](#architecture-overview)
  - [Backend Architecture](#backend-architecture)
    - [API Layer](#api-layer)
    - [Async Worker Layer (Celery)](#async-worker-layer-celery)
    - [Notification Bus (SSE)](#notification-bus-sse)
    - [Database](#database)
  - [Frontend Architecture](#frontend-architecture)
    - [Page Structure](#page-structure)
    - [State Management](#state-management)
  - [Deployment Architecture](#deployment-architecture)
    - [AWS Infrastructure](#aws-infrastructure)
    - [Docker \& Local Stack](#docker--local-stack)
    - [CI/CD Pipeline](#cicd-pipeline)
    - [Infrastructure as Code (Terraform)](#infrastructure-as-code-terraform)
  - [Getting Started](#getting-started)
    - [Local Development](#local-development)
    - [Environment Variables](#environment-variables)
  - [Tech Stack](#tech-stack)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          AWS VPC (us-east-1)                        │
│                                                                     │
│   ┌──────────────────────────────────────────────────────────────┐  │
│   │                Application Load Balancer (ALB)               │  │
│   └────────────────────────┬─────────────────┬───────────────────┘  │
│                            │ /api/*           │ /*                  │
│              ┌─────────────▼──────┐  ┌───────▼──────────┐          │
│              │  Backend ECS Task  │  │ Frontend ECS Task │          │
│              │  FastAPI + Gunicorn│  │   React + Nginx   │          │
│              │  (Fargate)         │  │   (Fargate)       │          │
│              └────────┬───────────┘  └──────────────────┘          │
│                       │                                             │
│          ┌────────────┼───────────────┐                             │
│          │            │               │                             │
│   ┌──────▼───┐  ┌─────▼──────┐  ┌────▼──────────────┐             │
│   │ RDS      │  │ElastiCache │  │  SQS Queue         │             │
│   │Postgres  │  │  Redis     │  │ (choremate-tasks)   │             │
│   │(t3.micro)│  │(t3.micro)  │  │  + Dead-Letter Q   │             │
│   └──────────┘  └─────┬──────┘  └────────────────────┘             │
│                        │ Pub/Sub              │                     │
│                        │             ┌────────▼──────────┐          │
│                        └─────────────│  Celery Worker    │          │
│                              SSE     │  ECS Task         │          │
│                              Events  │  (Fargate)        │          │
│                                      └───────────────────┘          │
└──────────────────────────────────────────────────────────────────────┘
```

The system has **two separate deployment units from the same Docker image**:
- **API process** — Gunicorn + FastAPI, handles HTTP requests and SSE streams
- **Worker process** — Celery, processes LLM and scheduling tasks off the request path

They share a Postgres database (read/write) and Redis (task results + SSE pub/sub).

---

## Backend Architecture

### API Layer

The backend is a **FastAPI** application (`backend/app/`) structured as follows:

```
backend/app/
├── main.py              # App factory, router registration, CORS, lifespan hook
├── worker.py            # Celery application definition (SQS broker + Redis backend)
├── tasks.py             # All Celery task definitions
├── api/
│   ├── dependencies.py  # Shared Depends() — JWT auth, DB session
│   └── routes/
│       ├── auth.py          # POST /auth/login, /auth/register
│       ├── user.py          # GET/PATCH /user/me
│       ├── user_preferences.py  # Survey responses, POST /user-preferences
│       ├── house.py         # POST /house, GET /house, POST /house/join
│       ├── chores.py        # Chore CRUD, ticket management, swap requests
│       ├── stats.py         # GET /stats/dashboard, /stats/fairness-report
│       ├── chatbot.py       # AI chatbot — async trigger + result poll
│       ├── notifications.py # GET /notifications/, SSE stream endpoint
│       └── admin.py         # Queue depth, burst trigger (load testing helpers)
├── core/
│   ├── security.py                # JWT issue/verify, bcrypt hashing
│   ├── default_chores.py          # 30+ pre-seeded chore definitions
│   ├── generate_house_chores.py   # LLM-assisted initial chore list generation
│   ├── generate_weekly_tickets.py # Fairness-aware weekly scheduler
│   ├── generate_monthly_tickets.py# Monthly cadence scheduler
│   ├── find_best_user_for_chore.py# Scoring: preference affinity + workload
│   ├── request_swap.py            # Swap proposal, accept, reject logic
│   └── notifications_bus.py       # SSE signal bus (in-memory or Redis pub/sub)
├── db/
│   └── database.py      # SQLAlchemy engine + SessionLocal factory
├── models/
│   └── model.py         # SQLAlchemy ORM models
└── schemas/
    └── schema.py        # Pydantic v2 request/response schemas
```

**Design principle:** Every HTTP handler is thin. Anything taking >200 ms (LLM calls, bulk ticket generation) is offloaded to Celery — the handler returns a `task_id` immediately and the client polls the result.

### Async Worker Layer (Celery)

```
POST /chores/generate-house-chores
    │
    │  .delay(house_id)
    ▼
[SQS Queue: choremate-tasks]
    │
    ▼
Celery Worker (separate ECS task)
    ├── generate_house_chores_task()   — Gemini LLM → chore list
    ├── generate_weekly_tickets_task() — fairness algorithm → DB write
    ├── generate_monthly_tickets_task()— monthly cadence → DB write
    └── process_chat_message_task()    — Gemini LLM → save message → push SSE
```

**Worker configuration** (`worker.py`):

| Setting                  | Value                                | Reason                                                       |
| ------------------------ | ------------------------------------ | ------------------------------------------------------------ |
| Broker                   | SQS (`sqs://`) in AWS, Redis locally | Fully managed, no broker infra to operate                    |
| Result backend           | Redis                                | Same instance as SSE pub/sub; avoids extra dependency        |
| `prefetch_multiplier`    | 1                                    | LLM calls are slow; don't pre-fetch tasks that will queue    |
| `max_tasks_per_child`    | 50                                   | Recycle worker after 50 tasks to prevent memory leaks        |
| `task_acks_late`         | True                                 | Task only removed from queue after completion, not on pickup |
| SQS `visibility_timeout` | 300 s                                | Covers worst-case LLM inference time                         |
| Dead-letter queue        | `maxReceiveCount=3`                  | Poison messages don't loop forever                           |

The same Docker image runs both the API and the worker — the entrypoint switches between them via the `WORKER_MODE` environment variable.

### Notification Bus (SSE)

Instead of polling, clients receive real-time updates via **Server-Sent Events** backed by Redis pub/sub in production, or in-memory asyncio queues in local development.

```
Celery Worker                   FastAPI SSE stream
(separate process)              GET /notifications/stream
      │                                   │
      │  redis.publish("notif:{user_id}") │  async with sse_listener(user_id) as q:
      ▼                                   │       signal = await q.get()
 Redis Pub/Sub ──── daemon thread ──────► │           (loop.call_soon_threadsafe)
                   (sync client)          │       yield ServerSentEvent(...)
```

**The thread-bridging solution** (`core/notifications_bus.py`):

FastAPI's event loop cannot be called from a Celery worker (different process) or from a synchronous thread. The notification bus solves this with three separate publish paths:

- `publish_notification_async(user_id)` — called from `async` route handlers; uses `redis.asyncio`
- `publish_notification_sync(user_id)` — called from sync handlers; uses `loop.call_soon_threadsafe()` with the loop stored at startup via `set_main_loop()`
- `publish_notification_from_worker(user_id)` — called from Celery tasks; uses the synchronous `redis` client directly (no event loop involved)

On the **subscriber side**, `_redis_listener()` spawns a daemon thread that blocks on the synchronous `pubsub.listen()`. When an event arrives, it calls `loop.call_soon_threadsafe(q.put_nowait, "ping")` to safely inject the signal into FastAPI's async event loop — giving the connection stability of synchronous sockets without blocking the async server.

Controlled via `NOTIFICATION_BACKEND` env var:
- `"memory"` (default) — asyncio queues, single-process dev
- `"redis"` — Redis pub/sub, required for multi-instance ECS production

### Database

**SQLAlchemy 2.0** with two supported engines:

| Environment      | Engine              | Notes                                            |
| ---------------- | ------------------- | ------------------------------------------------ |
| Local dev        | SQLite              | Zero-config, file at `backend/choremate.db`      |
| Production (AWS) | PostgreSQL 15 (RDS) | MVCC concurrency, connection pool via SQLAlchemy |

**Core models:**

```
User ──────────────────────────── HouseUser ──── House
  │                                                 │
  ├── UserPreference (survey scores)                ├── Chore
  ├── Message (chatbot history)                     │     └── ChoreTicket
  └── Notification                                  │           └── SwapRequest
                                                    └── (invite_code)
```

---

## Frontend Architecture

A **React 18** single-page app built with **Vite**, served by **Nginx** in production.

```
choremate-app/src/
├── App.jsx              # View-state machine (no router library — view key switch)
├── pages/
│   ├── loginPage.jsx            # Auth — login + register
│   ├── houseHoldSelection.jsx   # Create or join household
│   ├── createHouseHold.jsx      # New household form + invite code display
│   ├── surveyFlow.jsx           # Multi-step preference survey
│   ├── waitingForRoomatePage.jsx# Polls join status until all roommates ready
│   ├── generatedSchedulePage.jsx# First schedule preview — accept or adjust
│   ├── dashboard.jsx            # Main app: summary, completion ring, quick-complete
│   ├── HouseholdChoresPage.jsx  # All household chores (admin view)
│   ├── MyChoresPage.jsx         # Personal ticket list + completion
│   ├── RoommatesPage.jsx        # Per-roommate stats, swap initiation
│   └── AIChatbotPage.jsx        # Chat UI — SSE streaming, typing indicator
├── components/          # Reusable UI components (modals, charts, cards)
└── utils/
    └── api.js           # Axios client — all API calls, auth token injection
```

### Page Structure

Navigation is handled by a **view-state machine** in `App.jsx` — no React Router. The current view is stored as a string in component state and switched on user actions, keeping the app simple and predictable.

**User journey:**

```
Login / Register
    │
    ▼
Household Selection ──► Create Household ──► Survey Flow ──► Waiting Room
    │                                                              │
    │ (existing household)                                         ▼
    └─────────────────────────────────────────────────── Generated Schedule
                                                                   │
                                                                   ▼
                                                              Dashboard ──► [tab navigation]
                                                                            ├── My Chores
                                                                            ├── All Chores
                                                                            ├── Roommates
                                                                            └── AI Chatbot
```

### State Management

- **Auth token** — stored in `localStorage`, injected into all Axios requests via a request interceptor
- **Page state** — local React `useState` per page (no Redux/Zustand; app is mostly server-state-driven)
- **Real-time** — `AIChatbotPage` opens an SSE connection to `GET /notifications/stream` to receive chatbot completion signals without polling

---

## Deployment Architecture

### AWS Infrastructure

All infrastructure is defined in `terraform/` and provisioned with a single `terraform apply`.

```
terraform/
├── versions.tf          # AWS provider ~> 5.40, Terraform >= 1.6
├── variables.tf         # All tunable parameters (region, sizes, counts)
├── outputs.tf           # ALB DNS, ECR URIs, RDS endpoint
├── networking.tf        # VPC, subnets, IGW, NAT gateway, route tables
├── security_groups.tf   # Per-service SGs with least-privilege rules
├── ecr.tf               # Two ECR repos (backend + frontend)
├── rds.tf               # Postgres 15, private subnet, SSM credentials
├── elasticache.tf       # Redis 7, private subnet
├── sqs.tf               # choremate-tasks queue + DLQ
├── ecs_backend.tf       # Fargate: API task definition + service + ALB TG
├── ecs_frontend.tf      # Fargate: Nginx task definition + service + ALB rule
├── efs.tf               # EFS persistent volume (SQLite fallback / dev)
├── iam.tf               # Execution role + task role (SQS, SSM, EFS, CW)
├── ssm.tf               # SecureString params (DB URL, Redis URL, secrets)
├── autoscaling.tf       # Target-tracking on CPU (70%) + ALB req/target (500)
└── cloudwatch.tf        # Log groups + SQS depth alarm
```

**Service sizing:**

| Service           | Type           | CPU | Memory  | Min | Max |
| ----------------- | -------------- | --- | ------- | --- | --- |
| Backend API       | ECS Fargate    | 512 | 1024 MB | 1   | 4   |
| Frontend          | ECS Fargate    | 256 | 512 MB  | 1   | 1   |
| Celery Worker     | ECS Fargate    | 512 | 1024 MB | 1   | 4   |
| RDS Postgres      | db.t3.micro    | —   | —       | —   | —   |
| ElastiCache Redis | cache.t3.micro | —   | —       | —   | —   |

**Secrets management:** All sensitive values (database URL, Redis URL, `GEMINI_API_KEY`, `JWT_SECRET`) are stored as SSM `SecureString` parameters and injected into ECS task definitions as `valueFrom` references — never in plaintext in the task definition or Docker image.

### Docker & Local Stack

```bash
# Full local stack (API + Worker + Frontend + LocalStack SQS)
docker compose up

# Services:
#   backend-api    → http://localhost:8000
#   frontend       → http://localhost:3000
#   localstack     → http://localhost:4566 (SQS emulation)
```

The local stack uses **LocalStack** to emulate AWS SQS, so the full Celery/SQS flow works locally without an AWS account. `scripts/init-localstack.sh` creates the `choremate-tasks` queue automatically on container start.

**Switching between local and AWS SQS:**

| Env Var             | Local                                      | AWS                                     |
| ------------------- | ------------------------------------------ | --------------------------------------- |
| `CELERY_BROKER_URL` | `sqs://`                                   | `sqs://`                                |
| `SQS_QUEUE_URL`     | `http://localstack:4566/…/choremate-tasks` | `https://sqs.us-east-1.amazonaws.com/…` |
| `AWS_ENDPOINT_URL`  | `http://localstack:4566`                   | *(unset — uses real AWS)*               |

### CI/CD Pipeline

```
Pull Request
    │
    ├── black --check backend/        (code formatting gate)
    └── pytest backend/tests/         (test gate — blocks merge on failure)

Merge to main
    │
    ├── docker build backend → push to ECR (choremate-backend:latest)
    ├── docker build frontend → push to ECR (choremate-frontend:latest)
    └── aws ecs update-service --force-new-deployment
            ├── backend-api service
            └── backend-worker service
            (waits for service stability before marking green)
```

AWS credentials are obtained via **OIDC role assumption** — no long-lived keys are stored in GitHub secrets.

### Infrastructure as Code (Terraform)

```bash
cd terraform

# First time setup
terraform init
cp terraform.tfvars.example terraform.tfvars
# Fill in terraform.tfvars with your values

# Preview changes
terraform plan

# Deploy everything
terraform apply

# Outputs after apply:
#   alb_dns_name          = "choremate-alb-xxxx.us-east-1.elb.amazonaws.com"
#   backend_ecr_url       = "xxxx.dkr.ecr.us-east-1.amazonaws.com/choremate-backend"
#   frontend_ecr_url      = "xxxx.dkr.ecr.us-east-1.amazonaws.com/choremate-frontend"
#   rds_endpoint          = "choremate-db.xxxx.us-east-1.rds.amazonaws.com"

.scripts/deploy.sh # for deploying to AWS incase of any code changes done in backend or frontend. add --mock if you want to run it with the mock llm.

```

---

## Getting Started

### Local Development

**Prerequisites:** Python 3.12+, Node 18+, Docker

```bash
# 1. Clone the repo
git clone https://github.com/IamShrijan/choremate
cd choremate
```

**Option A — Full Docker stack (recommended)**

```bash
cp backend/.env.example backend/.env
# Fill in GEMINI_API_KEY and JWT_SECRET at minimum

docker compose up --build
# API  → http://localhost:8000  (Swagger: http://localhost:8000/docs)
# App  → http://localhost:3000
```

**Option B — Run services manually**

```bash
# Terminal 1 — Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # add GEMINI_API_KEY + JWT_SECRET
python create_db.py
uvicorn app.main:app --reload --port 8000

# Terminal 2 — Celery Worker (optional — needed for AI chatbot)
cd backend
source .venv/bin/activate
celery -A app.worker worker --loglevel=info

# Terminal 3 — Frontend
cd choremate-app
npm install
npm run dev          # → http://localhost:5173
```

### Environment Variables

**Backend** (`backend/.env`):

| Variable               | Required | Description                                                       |
| ---------------------- | -------- | ----------------------------------------------------------------- |
| `GEMINI_API_KEY`       | ✅        | Google Gemini API key                                             |
| `JWT_SECRET`           | ✅        | Secret for signing JWT tokens                                     |
| `DATABASE_URL`         | ❌        | Defaults to SQLite. Set to `postgresql+psycopg2://…` for Postgres |
| `REDIS_URL`            | ❌        | Redis connection string. Default: `redis://localhost:6379/0`      |
| `CELERY_BROKER_URL`    | ❌        | Broker URL. Default: `sqs://` (requires SQS_QUEUE_URL)            |
| `SQS_QUEUE_URL`        | ❌        | SQS queue endpoint (LocalStack or AWS)                            |
| `NOTIFICATION_BACKEND` | ❌        | `memory` (default, single process) or `redis` (multi-instance)    |
| `ALLOWED_ORIGINS`      | ❌        | Comma-separated CORS origins for production                       |
| `USE_MOCK_LLM`         | ❌        | Set `true` to skip Gemini calls (uses 3s sleep + dummy response)  |
| `WORKER_MODE`          | ❌        | `true` starts Celery worker instead of API server                 |

**Frontend** (`choremate-app/.env.local`):

| Variable            | Description                                             |
| ------------------- | ------------------------------------------------------- |
| `VITE_API_BASE_URL` | Backend API base URL (default: `http://localhost:8000`) |

---

## Tech Stack

| Layer                | Technology                                                                  |
| -------------------- | --------------------------------------------------------------------------- |
| **API Framework**    | FastAPI 0.104 + Uvicorn / Gunicorn                                          |
| **ORM**              | SQLAlchemy 2.0 + Pydantic v2                                                |
| **Database**         | SQLite (dev) · PostgreSQL 15 (prod, AWS RDS)                                |
| **Task Queue**       | Celery 5.3 + AWS SQS broker                                                 |
| **Cache / Pub-Sub**  | Redis 7 (AWS ElastiCache)                                                   |
| **AI**               | Google Gemini (`google-genai`)                                              |
| **Auth**             | JWT (`python-jose`) + bcrypt (`passlib`)                                    |
| **Frontend**         | React 18 + Vite                                                             |
| **Serving**          | Nginx (production frontend)                                                 |
| **Containerisation** | Docker + Docker Compose                                                     |
| **IaC**              | Terraform >= 1.6, AWS provider ~> 5.40                                      |
| **Cloud**            | AWS ECS Fargate, RDS, ElastiCache, SQS, ALB, ECR, EFS, SSM, IAM, CloudWatch |
| **CI/CD**            | GitHub Actions (OIDC → AWS)                                                 |
| **Testing**          | pytest 8.2 + pytest-asyncio                                                 |
| **Code Quality**     | Black (pre-commit hook + CI gate)                                           |