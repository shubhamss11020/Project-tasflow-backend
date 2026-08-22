# TaskFlow — Architecture & Technical Design Document

TaskFlow is a production-ready, multi-tenant project management backend engineered for scalability, high reliability, and strict security isolation.

---

## 1. High-Level System Architecture

```
                       +-------------------------------+
                       |   HTTP Clients (Web/Mobile)   |
                       +---------------+---------------+
                                       |
                                (REST API / JWT)
                                       v
                       +-------------------------------+
                       |  Express API Server (:3000)   |
                       |  - Helmet, CORS, Rate Limit   |
                       |  - Auth JWT & RBAC Middleware |
                       |  - Zod Request Validators     |
                       +---------------+---------------+
                                       |
                   +-------------------+-------------------+
                   |                                       |
        (Prisma ORM Queries)                     (BullMQ Job Enqueue)
                   |                                       |
                   v                                       v
         +--------------------+                  +--------------------+
         | PostgreSQL 16 DB   |                  |   Redis 7 Server   |
         | (Multi-tenant DB)  |                  | (BullMQ Queue/DLQ) |
         +--------------------+                  +---------+----------+
                                                           |
                                                  (Consume Jobs: 50/min)
                                                           v
                                                 +--------------------+
                                                 |  Background Worker |
                                                 |  (Email Processor) |
                                                 +--------------------+
```

---

## 2. Multi-Tenancy & Security Isolation Model

### 2.1 Row-Level Scoping via JWT Context
- Each authenticated user token contains `userId`, `email`, `orgId`, and `role`.
- **Client-provided `org_id` is never trusted**. All query filters automatically apply `organizationId: req.user.orgId`.
- If an entity (e.g. Project or Task) is requested by ID that does not belong to the user's organization:
  - The API returns **`403 Forbidden`** with `{ "error": "Access forbidden...", "code": "FORBIDDEN" }`.
  - Sensitive internal data, existence confirmations, and schema metadata are protected from leakage across tenants.

### 2.2 Authentication & Token Rotation Security
- **Passwords**: Hashed with `bcryptjs` using a cost factor $\ge 12$.
- **Access Tokens**: Short-lived JWTs (15 minutes TTL).
- **Refresh Tokens**: Long-lived (7 days TTL) stored in PostgreSQL with SHA-256 token hashing.
- **Refresh Token Family & Theft Protection**:
  - Each refresh token belongs to a `familyId`.
  - When a refresh token is used, it is rotated (revoked and replaced by a new token in the same family).
  - If an already-revoked refresh token is presented, the system flags token theft and revokes all tokens within that `familyId` immediately.
- **Rate Limiting**: `/auth/register`, `/auth/login`, `/auth/refresh`, and `/auth/logout` are rate-limited to **10 requests/minute/IP**.

---

## 3. Database Modeling & Index Justifications

### 3.1 Foreign Key Cascade vs Restrict Decisions
| Relation | On Delete | Justification |
| :--- | :--- | :--- |
| `Organization -> OrgMember` | `CASCADE` | If an organization is removed, member link records are cleanly purged. |
| `Organization -> Project` | `CASCADE` | Projects are owned by the organization; deleting an organization purges its projects. |
| `User -> Project.createdBy` | `RESTRICT` | Protects audit history and prevents accidental deletion of project creators while projects exist. |
| `Project -> Task` | `CASCADE` | Tasks belong to projects; deleting a project cascades to its tasks. |
| `User -> Task.createdBy` | `RESTRICT` | Preserves task creation audit logs. |
| `Task -> TaskAssignment` | `CASCADE` | Assignments are dependent on the task's existence. |
| `User -> TaskAssignment` | `CASCADE` | Deleting a user account cleans up their active assignments. |
| `Task -> Comment` | `CASCADE` | Comments belong to the task's discussion thread. |
| `User -> RefreshToken` | `CASCADE` | User deletion revokes and cleans all active login sessions. |

### 3.2 Database Indexes & Justifications
- `org_members(organization_id, user_id)`: Composite unique index for $O(1)$ membership checks and tenant verification.
- `projects(org_id, deleted_at)`: Composite index for tenant-scoped project queries excluding soft-deleted records.
- `tasks(project_id, status, deleted_at)`: Optimized composite index powering the project dashboard status aggregation and status filter queries.
- `tasks(due_date)`: B-tree index enabling fast date range queries (`dueDateStart` to `dueDateEnd`).
- `task_assignments(user_id)`: Index for quickly querying all tasks assigned to a specific team member.
- `refresh_tokens(token_hash)` & `refresh_tokens(family_id)`: Instant token lookup and token family revocation.

---

## 4. Background Jobs & Email Notifications (BullMQ + Redis)

### 4.1 Consistency & Failure Strategy
When assigning a task to a user:
1. The assignment record is persisted in PostgreSQL within the primary transaction.
2. The email notification job is dispatched asynchronously to the `email-notifications` BullMQ queue.
3. The API immediately returns success with `jobId` without blocking on SMTP or worker processing.
4. If Redis is temporarily unreachable during enqueue, the assignment remains safe in the database and the error is logged without failing the main transaction (or handled via Outbox pattern).

### 4.2 Retry & Dead-Letter Queue (DLQ) Strategy
- **Retry Count**: 3 attempts.
- **Backoff**: Exponential backoff ($1\text{s} \to 2\text{s} \to 4\text{s}$).
- **Dead-Letter Queue (`email-notifications-dlq`)**: If all 3 attempts fail, the worker automatically intercepts the failure, moves the job payload to the DLQ, and marks the job status as `failed`.
- **Deduplication**: Assignment jobs are deduplicated across a 5-second window using a custom deterministic `jobId` (`assignment-${taskId}-${userId}-${timeWindow}`).
- **Rate Limiting**: Global email rate limit of 50 emails/minute enforced at the worker queue level.

---

## 5. API Design & Pagination Specification

### 5.1 Offset Pagination
Query: `GET /tasks?page=1&limit=20`
```json
{
  "data": [...],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

### 5.2 Cursor Pagination
Query: `GET /tasks?cursor=task-uuid-123&limit=20`
```json
{
  "data": [...],
  "next_cursor": "task-uuid-456"
}
```

### 5.3 Standard Error Format
All errors return consistent JSON responses:
```json
{
  "error": "Task not found",
  "code": "TASK_NOT_FOUND",
  "details": {}
}
```
