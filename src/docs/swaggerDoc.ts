export const swaggerDocument = {
  openapi: '3.0.3',
  info: {
    title: 'TaskFlow REST API',
    version: '1.0.0',
    description:
      'TaskFlow is a production-grade multi-tenant project management backend demonstrating clean architecture, PostgreSQL modeling, JWT RBAC, BullMQ background jobs, and Docker Compose orchestration.'
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Local Development Server'
    }
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Provide your JWT access token'
      }
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Task not found' },
          code: { type: 'string', example: 'TASK_NOT_FOUND' },
          details: { type: 'object', example: {} }
        }
      },
      RegisterRequest: {
        type: 'object',
        required: ['email', 'password', 'firstName', 'lastName', 'orgName'],
        properties: {
          email: { type: 'string', format: 'email', example: 'alex@startup.io' },
          password: { type: 'string', minLength: 8, example: 'SecurePass123!' },
          firstName: { type: 'string', example: 'Alex' },
          lastName: { type: 'string', example: 'Morgan' },
          orgName: { type: 'string', example: 'Acme Corp' }
        }
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'alice@acme.com' },
          password: { type: 'string', example: 'Password123!' },
          orgId: { type: 'string', format: 'uuid', example: '00000000-0000-0000-0000-000000000000' }
        }
      },
      RefreshRequest: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: { type: 'string' }
        }
      },
      CreateProjectRequest: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', example: 'Cloud Infrastructure Upgrade' },
          description: { type: 'string', example: 'Migrate legacy microservices to Kubernetes' }
        }
      },
      CreateTaskRequest: {
        type: 'object',
        required: ['projectId', 'title'],
        properties: {
          projectId: { type: 'string', format: 'uuid' },
          title: { type: 'string', example: 'Deploy PostgreSQL Read Replicas' },
          description: { type: 'string', example: 'Setup streaming replication with pg_auto_failover' },
          status: { type: 'string', enum: ['todo', 'in_progress', 'review', 'done'], default: 'todo' },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
          dueDate: { type: 'string', format: 'date-time', example: '2026-09-01T12:00:00.000Z' }
        }
      },
      AssignTaskRequest: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'string', format: 'uuid', example: '11111111-1111-1111-1111-111111111111' }
        }
      },
      BulkStatusUpdateRequest: {
        type: 'object',
        required: ['taskIds', 'status'],
        properties: {
          taskIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
          status: { type: 'string', enum: ['todo', 'in_progress', 'review', 'done'] }
        }
      }
    }
  },
  paths: {
    '/auth/register': {
      post: {
        summary: 'Register new user and organization (Rate limited: 10 req/min)',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterRequest' } } }
        },
        responses: {
          201: { description: 'Registration successful' },
          400: { $ref: '#/components/schemas/ErrorResponse' },
          409: { description: 'Email already exists' }
        }
      }
    },
    '/auth/login': {
      post: {
        summary: 'Authenticate user & issue tokens (Rate limited: 10 req/min)',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } }
        },
        responses: {
          200: { description: 'Authentication successful with JWT & refresh token' },
          401: { description: 'Invalid credentials' }
        }
      }
    },
    '/auth/refresh': {
      post: {
        summary: 'Refresh access token with rotation (Rate limited: 10 req/min)',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RefreshRequest' } } }
        },
        responses: {
          200: { description: 'New token pair issued' },
          401: { description: 'Invalid or revoked refresh token' }
        }
      }
    },
    '/auth/logout': {
      post: {
        summary: 'Revoke refresh token (Rate limited: 10 req/min)',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RefreshRequest' } } }
        },
        responses: {
          200: { description: 'Logged out successfully' }
        }
      }
    },
    '/auth/logout-all': {
      post: {
        summary: 'Revoke all active sessions for authenticated user',
        tags: ['Authentication'],
        security: [{ BearerAuth: [] }],
        responses: {
          200: { description: 'All active sessions revoked' }
        }
      }
    },
    '/projects': {
      get: {
        summary: 'List all active projects for organization',
        tags: ['Projects'],
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'List of projects' } }
      },
      post: {
        summary: 'Create a new project',
        tags: ['Projects'],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateProjectRequest' } } }
        },
        responses: { 201: { description: 'Project created' } }
      }
    },
    '/projects/{id}': {
      get: {
        summary: 'Get project details by ID',
        tags: ['Projects'],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Project details' },
          403: { description: 'Cross-tenant access forbidden' },
          404: { description: 'Project not found' }
        }
      },
      delete: {
        summary: 'Soft-delete project (org_admin role required)',
        tags: ['Projects'],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Project deleted' },
          403: { description: 'Requires org_admin role or cross-tenant forbidden' }
        }
      }
    },
    '/projects/{id}/dashboard': {
      get: {
        summary: 'Get project dashboard with task counts grouped by status',
        tags: ['Projects'],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Dashboard metrics' } }
      }
    },
    '/tasks': {
      get: {
        summary: 'List tasks with filtering and offset/cursor pagination',
        tags: ['Tasks'],
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['todo', 'in_progress', 'review', 'done'] } },
          { name: 'priority', in: 'query', schema: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] } },
          { name: 'assigneeId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'dueDateStart', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'dueDateEnd', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'cursor', in: 'query', schema: { type: 'string' } }
        ],
        responses: { 200: { description: 'Paginated task list' } }
      },
      post: {
        summary: 'Create a new task',
        tags: ['Tasks'],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateTaskRequest' } } }
        },
        responses: { 201: { description: 'Task created' } }
      }
    },
    '/tasks/bulk-status': {
      patch: {
        summary: 'Bulk update status for multiple tasks',
        tags: ['Tasks'],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/BulkStatusUpdateRequest' } } }
        },
        responses: { 200: { description: 'Tasks updated' } }
      }
    },
    '/tasks/{id}/assign': {
      post: {
        summary: 'Assign user to task (triggers asynchronous BullMQ email job)',
        tags: ['Tasks'],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/AssignTaskRequest' } } }
        },
        responses: {
          200: { description: 'User assigned and email notification job enqueued' },
          400: { description: 'Assignee must belong to same organization' }
        }
      }
    },
    '/auth/oauth/google': {
      post: {
        summary: 'Google OAuth 2.0 Login / Register',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  token: { type: 'string', description: 'Google OAuth access token or id_token' },
                  email: { type: 'string', format: 'email' },
                  firstName: { type: 'string' },
                  lastName: { type: 'string' }
                }
              }
            }
          }
        },
        responses: { 200: { description: 'Authenticated with TaskFlow JWT tokens' } }
      }
    },
    '/auth/oauth/github': {
      post: {
        summary: 'GitHub OAuth 2.0 Login / Register',
        tags: ['Authentication'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  token: { type: 'string', description: 'GitHub OAuth access token or code' },
                  email: { type: 'string', format: 'email' },
                  firstName: { type: 'string' },
                  lastName: { type: 'string' }
                }
              }
            }
          }
        },
        responses: { 200: { description: 'Authenticated with TaskFlow JWT tokens' } }
      }
    },
    '/events/stream': {
      get: {
        summary: 'Server-Sent Events (SSE) live real-time stream',
        tags: ['Real-Time Events'],
        parameters: [{ name: 'token', in: 'query', schema: { type: 'string' }, description: 'JWT Access Token' }],
        responses: { 200: { description: 'text/event-stream real-time broadcast stream' } }
      }
    },
    '/notifications': {
      get: {
        summary: 'List user notifications with unread count',
        tags: ['Notifications'],
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'unreadOnly', in: 'query', schema: { type: 'boolean', default: false } }
        ],
        responses: { 200: { description: 'Paginated notification list' } }
      }
    },
    '/notifications/read-all': {
      patch: {
        summary: 'Mark all notifications as read',
        tags: ['Notifications'],
        security: [{ BearerAuth: [] }],
        responses: { 200: { description: 'All notifications marked as read' } }
      }
    },
    '/notifications/{id}/read': {
      patch: {
        summary: 'Mark a single notification as read',
        tags: ['Notifications'],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Notification marked as read' } }
      }
    },
    '/tasks/{id}/activity': {
      get: {
        summary: 'Get full activity audit history for a task',
        tags: ['Activity Logs'],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Activity audit logs' } }
      }
    },
    '/projects/{id}/activity': {
      get: {
        summary: 'Get full activity audit history for a project',
        tags: ['Activity Logs'],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Activity audit logs' } }
      }
    },
    '/email/test': {
      post: {
        summary: 'Test sending real email via SMTP (Gmail, Mailtrap, Brevo, AWS SES)',
        tags: ['Email Delivery'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['to'],
                properties: {
                  to: { type: 'string', format: 'email', example: 'your_email@gmail.com' },
                  subject: { type: 'string', example: 'Test SMTP Email Delivery' },
                  message: { type: 'string', example: 'Testing TaskFlow real email delivery' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Email sent successfully via SMTP' },
          500: { description: 'SMTP authentication or delivery failure' }
        }
      }
    },
    '/jobs/{id}': {
      get: {
        summary: 'Inspect BullMQ job status (pending, active, completed, failed)',
        tags: ['Background Jobs'],
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Job status details' },
          404: { description: 'Job not found' }
        }
      }
    }
  }
};
