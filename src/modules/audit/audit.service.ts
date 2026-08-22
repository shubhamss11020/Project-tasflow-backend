import { prisma } from '../../database/prisma';
import { sseService } from '../events/sse.service';

export interface LogActivityParams {
  orgId: string;
  userId: string;
  action: string;
  entityType: 'TASK' | 'PROJECT' | 'MEMBER' | 'COMMENT';
  projectId?: string;
  taskId?: string;
  metadata?: Record<string, any>;
}

export class AuditService {
  async logActivity(params: LogActivityParams) {
    const log = await prisma.auditLog.create({
      data: {
        orgId: params.orgId,
        userId: params.userId,
        action: params.action,
        entityType: params.entityType,
        projectId: params.projectId,
        taskId: params.taskId,
        metadata: params.metadata || {}
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    // Broadcast real-time activity to all members of the organization
    sseService.broadcastToOrg(params.orgId, 'activity', log);

    return log;
  }

  async getTaskActivity(taskId: string, orgId: string) {
    return prisma.auditLog.findMany({
      where: { taskId, orgId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });
  }

  async getProjectActivity(projectId: string, orgId: string) {
    return prisma.auditLog.findMany({
      where: { projectId, orgId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });
  }
}

export const auditService = new AuditService();
