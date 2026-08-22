import request from 'supertest';
import { app } from '../../src/app';
import { prisma } from '../../src/database/prisma';
import { hashPassword } from '../../src/common/utils/password';
import { generateAccessToken } from '../../src/common/utils/jwt';
import { OrgRole, TaskStatus, TaskPriority } from '@prisma/client';

// Mock BullMQ Queue to isolate Redis during integration test suite
jest.mock('../../src/queues/emailQueue', () => {
  return {
    EMAIL_QUEUE_NAME: 'email-notifications',
    EMAIL_DLQ_NAME: 'email-notifications-dlq',
    emailQueue: {
      getJob: jest.fn().mockImplementation(async (id: string) => {
        if (id === 'job-123') {
          return {
            id: 'job-123',
            name: 'sendTaskAssignmentNotification',
            getState: async () => 'completed',
            data: { taskId: 'task-1', taskTitle: 'Test Task' },
            returnvalue: { success: true },
            failedReason: null,
            attemptsMade: 1,
            opts: { attempts: 3 },
            timestamp: Date.now(),
            processedOn: Date.now(),
            finishedOn: Date.now()
          };
        }
        return null;
      })
    },
    emailDlqQueue: {
      getJob: jest.fn().mockResolvedValue(null)
    },
    enqueueTaskAssignmentEmail: jest.fn().mockResolvedValue({ id: 'job-mock-123' })
  };
});

describe('Integration Test: API Endpoints & Multi-Tenant Security', () => {
  describe('GET /health', () => {
    it('should return 200 OK with status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('Authentication Endpoints (/auth)', () => {
    it('should return 400 with VALIDATION_ERROR on empty payload to /auth/register', async () => {
      const res = await request(app).post('/auth/register').send({});
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.details).toBeDefined();
    });

    it('should return 400 on invalid login format', async () => {
      const res = await request(app).post('/auth/login').send({ email: 'not-an-email' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('JWT Middleware & Authentication Protection', () => {
    it('should return 401 UNAUTHORIZED when accessing protected routes without Bearer token', async () => {
      const res = await request(app).get('/projects');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('should return 401 on invalid Bearer token', async () => {
      const res = await request(app)
        .get('/projects')
        .set('Authorization', 'Bearer invalid-token-string');
      expect(res.status).toBe(401);
    });
  });

  describe('Cross-Tenant Isolation & 403 Forbidden', () => {
    const org1Token = generateAccessToken({
      userId: '11111111-1111-1111-1111-111111111111',
      email: 'alice@org1.com',
      orgId: '11111111-1111-1111-1111-111111111111',
      role: OrgRole.member
    });

    it('should return 403 Forbidden when attempting to access project from another organization', async () => {
      // Mock findUnique for orgMember check in auth middleware
      jest.spyOn(prisma.orgMember, 'findUnique').mockResolvedValueOnce({
        id: 'mem-1',
        organizationId: '11111111-1111-1111-1111-111111111111',
        userId: '11111111-1111-1111-1111-111111111111',
        role: OrgRole.member,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Mock findFirst returning project belonging to Org 2 (cross-tenant)
      jest.spyOn(prisma.project, 'findFirst').mockResolvedValueOnce({
        id: 'proj-foreign',
        organizationId: '22222222-2222-2222-2222-222222222222', // different org!
        name: 'Secret Org 2 Project',
        description: 'Classified',
        createdById: 'user-2',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null
      });

      const res = await request(app)
        .get('/projects/proj-foreign')
        .set('Authorization', `Bearer ${org1Token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('should return 403 Forbidden when non-admin attempts to delete a project', async () => {
      // Non-admin member
      const memberToken = generateAccessToken({
        userId: '11111111-1111-1111-1111-111111111111',
        email: 'bob@org1.com',
        orgId: '11111111-1111-1111-1111-111111111111',
        role: OrgRole.member
      });

      jest.spyOn(prisma.orgMember, 'findUnique').mockResolvedValueOnce({
        id: 'mem-1',
        organizationId: '11111111-1111-1111-1111-111111111111',
        userId: '11111111-1111-1111-1111-111111111111',
        role: OrgRole.member, // not org_admin!
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const res = await request(app)
        .delete('/projects/proj-123')
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });
  });

  describe('Task Assignment & Validation', () => {
    const adminToken = generateAccessToken({
      userId: '11111111-1111-1111-1111-111111111111',
      email: 'admin@org1.com',
      orgId: '11111111-1111-1111-1111-111111111111',
      role: OrgRole.org_admin
    });

    it('should return 400 when assigning a user not in the same organization', async () => {
      jest.spyOn(prisma.orgMember, 'findUnique')
        // Auth check
        .mockResolvedValueOnce({
          id: 'mem-1',
          organizationId: '11111111-1111-1111-1111-111111111111',
          userId: '11111111-1111-1111-1111-111111111111',
          role: OrgRole.org_admin,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        // Target assignee org membership check -> null (not in org)
        .mockResolvedValueOnce(null);

      jest.spyOn(prisma.task, 'findFirst').mockResolvedValueOnce({
        id: 'task-100',
        projectId: 'proj-1',
        title: 'Important Task',
        description: 'Details',
        status: TaskStatus.todo,
        priority: TaskPriority.high,
        dueDate: null,
        createdById: '11111111-1111-1111-1111-111111111111',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        project: {
          id: 'proj-1',
          name: 'Acme Project',
          organizationId: '11111111-1111-1111-1111-111111111111'
        },
        creator: {},
        assignments: [],
        comments: []
      } as any);

      const res = await request(app)
        .post('/tasks/task-100/assign')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ userId: '33333333-3333-3333-3333-333333333333' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_ASSIGNEE');
    });
  });

  describe('GET /jobs/:id (BullMQ status)', () => {
    const userToken = generateAccessToken({
      userId: '11111111-1111-1111-1111-111111111111',
      email: 'alice@acme.com',
      orgId: '11111111-1111-1111-1111-111111111111',
      role: OrgRole.org_admin
    });

    it('should return job status information for valid job ID', async () => {
      jest.spyOn(prisma.orgMember, 'findUnique').mockResolvedValueOnce({
        id: 'mem-1',
        organizationId: '11111111-1111-1111-1111-111111111111',
        userId: '11111111-1111-1111-1111-111111111111',
        role: OrgRole.org_admin,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const res = await request(app)
        .get('/jobs/job-123')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('job-123');
      expect(res.body.data.status).toBe('completed');
    });
  });
});
