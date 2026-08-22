# TaskFlow — Backend Developer Technical Assignment

TaskFlow is a production-ready, multi-tenant project management backend built with **Node.js**, **TypeScript**, **Express**, **PostgreSQL (Prisma ORM)**, **Redis**, and **BullMQ**, fully containerized with **Docker Compose**.

---

## 🏛️ System Architecture Overview

```
                      +---------------------------------------------------+
                      |             CLIENTS / USERS / BROWSERS            |
                      |   (React / Next.js / Mobile App / Postman Client) |
                      +-------------------------+-------------------------+
                                                |
                              1. HTTP REST Requests | 2. SSE EventStream (:3000/events/stream)
                                                v
                      +---------------------------------------------------+
                      |             TASKFLOW EXPRESS API SERVER           |
                      |  - Helmet, CORS, Morgan Logger, Rate Limiting     |
                      |  - JWT Authentication (15m Access, 7d Refresh)    |
                      |  - RBAC Middleware (org_admin, member)            |
                      |  - Multi-Tenant Row-Level Scoping (org_id)        |
                      |  - Zod Request Validation & Error Interceptor     |
                      +-----------+-------------------+---------------+---+
                                  |                   |               |
             Prisma ORM (DB Pool) |     Enqueue Job   |               | Live SSE Events
                                  v                   v               v
               +--------------------+   +-------------------+   +--------------------+
               |   POSTGRESQL 16    |   |      REDIS 7      |   |  CONNECTED CLIENTS |
               | (Multi-Tenant DB)  |   |  (BullMQ Broker)  |   | (Live Dashboard)   |
               | - users            |   | - email-queue     |   +--------------------+
               | - organizations    |   | - email-dlq       |
               | - org_members      |   +---------+---------+
               | - projects         |             |
               | - tasks            |             | Consume Jobs (50/min Rate Limit)
               | - task_assignments |             v
               | - comments         |   +------------------------------------+
               | - notifications    |   |    BULLMQ BACKGROUND WORKER        |
               | - audit_logs       |   |  - 3 Retries (1s -> 2s -> 4s)      |
               | - refresh_tokens   |   |  - Dead-Letter Queue on Exhaustion |
               +--------------------+   |  - Unified Email Service           |
                                        |    (Resend API / SMTP / Mock)      |
                                        +-----------------+------------------+
                                                          |
                                                          | Deliver HTML Emails
                                                          v
                                        +------------------------------------+
                                        |         RECIPIENT INBOXES          |
                                        |  (Invites, Assignments, Updates)   |
                                        +------------------------------------+
```

---

## 🌟 Key Features & Implementation Highlights

- **Multi-Tenant Scoping & Security**: Strict row-level organization scoping via JWT context (`orgId`, `userId`, `role`). Client-provided `org_id` is never trusted; cross-tenant access returns standard `403 Forbidden` (`FORBIDDEN`).
- **PostgreSQL Database Design (Prisma ORM)**:
  - Tables: `users`, `organizations`, `org_members`, `projects`, `tasks`, `task_assignments`, `comments`, `notifications`, `audit_logs`, `refresh_tokens`.
  - Documented `CASCADE` vs `RESTRICT` foreign key relationships.
  - Native Enums: `OrgRole`, `TaskStatus`, `TaskPriority`, `NotificationType`.
  - Optimized Composite Indexes on `(project_id, status, deleted_at)`, `(org_id, deleted_at)`, `(due_date)`, and `(user_id)`.
  - Soft delete support (`deleted_at`) on projects & tasks.
  - PostgreSQL full-text search capability.
- **Authentication & RBAC**:
  - `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/logout-all`.
  - **OAuth 2.0 (Google & GitHub)**: `POST /auth/oauth/google`, `POST /auth/oauth/github`.
  - `bcrypt` password hashing with cost factor $\ge 12$.
  - 15-minute JWT access token + 7-day refresh token in DB with **Refresh Token Rotation & Family Theft Protection**.
  - Rate limiting on authentication endpoints (**10 requests/minute/IP**).
  - RBAC roles (`org_admin`, `member`) where admins can manage members and delete projects.
- **In-App Notifications & Real-Time SSE**:
  - `GET /notifications` (paginated list with unread counter).
  - `PATCH /notifications/:id/read` & `PATCH /notifications/read-all`.
  - `GET /events/stream` (Live Server-Sent Events stream for instant real-time dashboard updates).
- **Activity & Audit Logs**:
  - `GET /tasks/:taskId/activity` & `GET /projects/:projectId/activity` (Full history of task/project changes).
- **REST API - Projects & Tasks**:
  - Clean `Route -> Controller -> Service -> DB` layered architecture.
  - Full CRUD for projects and tasks.
  - Task filters: `status`, `priority`, `assigneeId`, `dueDateStart`, `dueDateEnd`, `search`.
  - **Dual Pagination**: **Offset pagination** (`{ data, total, page, limit }`) and **Cursor pagination** (`{ data, next_cursor }`).
  - Zod validation for all request payloads.
  - Task assignment/unassignment with same-organization validation.
  - Project dashboard metrics endpoint with task counts grouped by status.
  - **Bonus**: Bulk task status update endpoint (`PATCH /tasks/bulk-status`).
- **Background Jobs & Email Notifications (BullMQ + Redis)**:
  - Asynchronous email notifications on task assignment, member invites, task changes, and comments.
  - 3 retries with exponential backoff ($1\text{s} \to 2\text{s} \to 4\text{s}$).
  - Dead-Letter Queue (`email-notifications-dlq`) for exhausted retries.
  - `GET /jobs/:id` endpoint for inspecting job status (`pending`, `active`, `completed`, `failed`).
  - 5-second task assignment deduplication.
  - Global email rate limit (50 emails/minute).
- **API Documentation & Testing**:
  - Interactive Swagger UI at `http://localhost:3000/api-docs`.
  - Ready-to-import Postman collection: [`TaskFlow.postman_collection.json`](./TaskFlow.postman_collection.json).
  - Ready-to-import Bruno collection in [`bruno/`](./bruno/).
  - 24 automated unit and integration tests with Jest & Supertest.

---

## 🚀 Quick Start with Docker Compose (Recommended)

Start the complete stack (API, Worker, PostgreSQL, Redis) with a single command:

```bash
docker compose up --build
```

The services will start on:
- **API Server**: `http://localhost:3000`
- **Swagger UI**: `http://localhost:3000/api-docs`
- **PostgreSQL**: `localhost:5432`
- **Redis**: `localhost:6379`

To seed initial demo data into the running Docker container:
```bash
docker compose exec api npm run prisma:seed
```

---

## 🛠️ Local Development Setup (Bare Metal)

### 1. Prerequisites
- **Node.js** >= 18.x / 20.x
- **PostgreSQL** 15+ running locally
- **Redis** 6+ running locally

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### 4. Database Migrations & Seeding
```bash
# Run Prisma migrations
npx prisma migrate dev --name init

# Seed database with sample data (2 orgs, 5 users, 12 tasks, assignments, comments)
npm run prisma:seed
```

### 5. Start the API Server & Background Worker
```bash
# Terminal 1 - Start API Server
npm run dev

# Terminal 2 - Start BullMQ Background Worker
npm run dev:worker
```

---

## 🧪 Running Automated Tests

Run the complete test suite (Unit & Integration tests):
```bash
npm test
```

Generate a test coverage report:
```bash
npm run test:coverage
```

---

## 📖 API Documentation & Postman Collection

### 1. Swagger UI
Access the interactive OpenAPI 3.0 documentation at:
**`http://localhost:3000/api-docs`**

### 2. Postman Collection
Import [`TaskFlow.postman_collection.json`](./TaskFlow.postman_collection.json) directly into Postman.
- Pre-configured with `{{baseUrl}}` and auto-token capture on Login & Register.
- Default seeded test accounts:
  - **Admin User (Org 1 - Acme Corp)**: `alice@acme.com` / `Password123!`
  - **Member User (Org 1 - Acme Corp)**: `bob@acme.com` / `Password123!`
  - **Admin User (Org 2 - Stark Industries)**: `dave@stark.com` / `Password123!`

---

## 📂 Seeded Demo Data Overview

| User Email | Organization | Role | Sample Data |
| :--- | :--- | :--- | :--- |
| `alice@acme.com` | Acme Corporation | `org_admin` | 2 Projects, 9 Tasks, Comments |
| `bob@acme.com` | Acme Corporation | `member` | Assigned tasks, comments |
| `charlie@acme.com` | Acme Corporation | `member` | Assigned tasks, comments |
| `dave@stark.com` | Stark Industries | `org_admin` | 1 Project, 3 Tasks |
| `eve@stark.com` | Stark Industries | `member` | Assigned tasks |

---

## 🏗️ Project Directory Structure

```
.
├── docker-compose.yml          # Multi-container orchestration (api, worker, postgres, redis)
├── Dockerfile                  # Multi-stage Docker build with Alpine OpenSSL support
├── package.json                # Dependencies and npm scripts
├── tsconfig.json               # TypeScript configuration
├── ARCHITECTURE.md             # In-depth architectural design & technical decisions
├── TaskFlow.postman_collection.json # Ready-to-import Postman collection
├── prisma/
│   ├── schema.prisma           # Prisma schema with models, enums, FK constraints, and indexes
│   ├── seed.ts                 # Database seed script
│   └── migrations/             # Migration SQL files
├── src/
│   ├── app.ts                  # Express app setup with middleware & routes
│   ├── server.ts               # Server entry point
│   ├── config/                 # Environment variables & constants
│   ├── database/               # Prisma singleton client
│   ├── queues/                 # BullMQ queue & deduplication logic
│   ├── workers/                # BullMQ background email worker
│   ├── middleware/             # Auth JWT, RBAC, Rate limiting, Error handler, Zod validator
│   ├── common/
│   │   ├── errors/             # AppError & specialized error classes
│   │   ├── utils/              # EmailService, JWT, password hashing, pagination
│   │   └── validators/         # Zod schemas
│   ├── docs/                   # OpenAPI / Swagger definition
│   └── modules/
│       ├── auth/               # Register, Login, Refresh, Logout, Logout-all, OAuth
│       ├── organizations/      # Org member management
│       ├── projects/           # Projects CRUD & dashboard stats
│       ├── tasks/              # Tasks CRUD, filters, pagination, assignment, bulk status
│       ├── comments/           # Task comments CRUD
│       ├── notifications/      # In-app notifications & read/unread management
│       ├── events/             # Real-time SSE event stream
│       ├── audit/              # Activity and audit log queries
│       └── jobs/               # BullMQ job status inspection (GET /jobs/:id)
└── tests/
    ├── setup.ts                # Test setup configuration
    ├── unit/                   # Unit tests (auth, cryptography, pagination, validation)
    └── integration/            # Integration tests (Supertest API, RBAC, cross-tenant 403)
```
