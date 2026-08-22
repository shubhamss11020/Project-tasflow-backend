import { prisma } from '../../database/prisma';
import {
  TaskNotFoundError,
  ProjectNotFoundError,
  ForbiddenError,
  BadRequestError,
  NotFoundError,
  ConflictError
} from '../../common/errors/AppError';
import { TaskStatus, TaskPriority, Prisma } from '@prisma/client';
import {
  parsePaginationParams,
  formatOffsetResponse,
  formatCursorResponse
} from '../../common/utils/pagination';
import { enqueueTaskAssignmentEmail } from '../../queues/emailQueue';

export interface CreateTaskInput {
  projectId: string;
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
}

export interface TaskFilterOptions {
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string;
  dueDateStart?: string;
  dueDateEnd?: string;
  search?: string;
  page?: number;
  limit?: number;
  cursor?: string;
}

export class TaskService {
  async listTasks(orgId: string, filters: TaskFilterOptions) {
    const where: Prisma.TaskWhereInput = {
      deletedAt: null,
      project: {
        organizationId: orgId,
        deletedAt: null
      }
    };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.priority) {
      where.priority = filters.priority;
    }

    if (filters.assigneeId) {
      where.assignments = {
        some: {
          userId: filters.assigneeId
        }
      };
    }

    if (filters.dueDateStart || filters.dueDateEnd) {
      where.dueDate = {};
      if (filters.dueDateStart) {
        where.dueDate.gte = new Date(filters.dueDateStart);
      }
      if (filters.dueDateEnd) {
        where.dueDate.lte = new Date(filters.dueDateEnd);
      }
    }

    // Full-Text Search / Search Bonus
    if (filters.search && filters.search.trim() !== '') {
      const searchTerm = filters.search.trim();
      where.OR = [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } }
      ];
    }

    const pagination = parsePaginationParams(filters as Record<string, any>);

    const include = {
      project: {
        select: { id: true, name: true, organizationId: true }
      },
      creator: {
        select: { id: true, email: true, firstName: true, lastName: true }
      },
      assignments: {
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true }
          }
        }
      },
      _count: {
        select: { comments: true }
      }
    };

    if (pagination.type === 'cursor') {
      const take = pagination.limit + 1;
      const tasks = await prisma.task.findMany({
        where,
        take,
        skip: pagination.cursor ? 1 : 0,
        cursor: pagination.cursor ? { id: pagination.cursor } : undefined,
        orderBy: { createdAt: 'desc' },
        include
      });

      return formatCursorResponse(tasks, pagination.limit);
    }

    // Offset pagination
    const [total, tasks] = await Promise.all([
      prisma.task.count({ where }),
      prisma.task.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
        include
      })
    ]);

    return formatOffsetResponse(tasks, total, pagination.page, pagination.limit);
  }

  async getTaskById(taskId: string, orgId: string) {
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        deletedAt: null
      },
      include: {
        project: {
          select: { id: true, name: true, organizationId: true }
        },
        creator: {
          select: { id: true, email: true, firstName: true, lastName: true }
        },
        assignments: {
          include: {
            user: {
              select: { id: true, email: true, firstName: true, lastName: true }
            }
          }
        },
        comments: {
          include: {
            author: {
              select: { id: true, email: true, firstName: true, lastName: true }
            }
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!task) {
      throw new TaskNotFoundError();
    }

    if (task.project.organizationId !== orgId) {
      throw new ForbiddenError('Access denied: Task belongs to another organization');
    }

    return task;
  }

  async createTask(orgId: string, userId: string, input: CreateTaskInput) {
    // Verify project exists and belongs to the user's organization
    const project = await prisma.project.findFirst({
      where: {
        id: input.projectId,
        deletedAt: null
      }
    });

    if (!project) {
      throw new ProjectNotFoundError();
    }

    if (project.organizationId !== orgId) {
      throw new ForbiddenError('Project belongs to another organization');
    }

    const task = await prisma.task.create({
      data: {
        projectId: input.projectId,
        createdById: userId,
        title: input.title,
        description: input.description,
        status: input.status || TaskStatus.todo,
        priority: input.priority || TaskPriority.medium,
        dueDate: input.dueDate ? new Date(input.dueDate) : null
      },
      include: {
        project: {
          select: { id: true, name: true, organizationId: true }
        },
        creator: {
          select: { id: true, email: true, firstName: true, lastName: true }
        },
        assignments: true
      }
    });

    try {
      const { auditService } = await import('../audit/audit.service');
      await auditService.logActivity({
        orgId,
        userId,
        projectId: task.projectId,
        taskId: task.id,
        action: 'TASK_CREATED',
        entityType: 'TASK',
        metadata: { title: task.title, status: task.status, priority: task.priority }
      });
    } catch {}

    return task;
  }

  async updateTask(taskId: string, orgId: string, input: UpdateTaskInput, updaterId?: string) {
    const task = await this.getTaskById(taskId, orgId);

    // Track changed fields
    const changes: Record<string, { from: any; to: any }> = {};
    if (input.title && input.title !== task.title) changes.title = { from: task.title, to: input.title };
    if (input.status && input.status !== task.status) changes.status = { from: task.status, to: input.status };
    if (input.priority && input.priority !== task.priority) changes.priority = { from: task.priority, to: input.priority };
    if (input.dueDate !== undefined) {
      const newDue = input.dueDate ? new Date(input.dueDate).toISOString() : null;
      const oldDue = task.dueDate ? task.dueDate.toISOString() : null;
      if (newDue !== oldDue) changes.dueDate = { from: oldDue, to: newDue };
    }

    const updatedTask = await prisma.task.update({
      where: { id: task.id },
      data: {
        title: input.title,
        description: input.description,
        status: input.status,
        priority: input.priority,
        dueDate: input.dueDate !== undefined ? (input.dueDate ? new Date(input.dueDate) : null) : undefined
      },
      include: {
        project: { select: { id: true, name: true } },
        creator: { select: { id: true, email: true, firstName: true, lastName: true } },
        assignments: {
          include: {
            user: { select: { id: true, email: true, firstName: true, lastName: true } }
          }
        }
      }
    });

    // Notify assignees and log audit trail if significant changes occurred
    if (Object.keys(changes).length > 0) {
      try {
        const { notificationService } = await import('../notifications/notification.service');
        const { emailService } = await import('../../common/utils/emailService');
        const { auditService } = await import('../audit/audit.service');

        const updaterName = updaterId ? 'A team member' : 'System';
        const changeSummary = Object.keys(changes).map((k) => `${k} changed`).join(', ');

        for (const assign of updatedTask.assignments) {
          const updateHtml = emailService.generateTaskUpdateTemplate({
            taskTitle: updatedTask.title,
            taskId: updatedTask.id,
            updaterName,
            changes
          });

          await notificationService.createNotification({
            userId: assign.user.id,
            orgId,
            type: 'TASK_UPDATED',
            title: `Task Updated: ${updatedTask.title}`,
            message: `${updaterName} updated task "${updatedTask.title}": ${changeSummary}.`,
            data: { taskId: updatedTask.id, changes },
            emailPayload: {
              to: assign.user.email,
              subject: `Update on Task: ${updatedTask.title}`,
              html: updateHtml
            }
          });
        }

        if (updaterId) {
          await auditService.logActivity({
            orgId,
            userId: updaterId,
            projectId: updatedTask.project.id,
            taskId: updatedTask.id,
            action: 'TASK_UPDATED',
            entityType: 'TASK',
            metadata: { changes }
          });
        }
      } catch (err) {
        console.error('Non-fatal: Failed to send task update notifications:', err);
      }
    }

    return updatedTask;
  }

  async deleteTask(taskId: string, orgId: string) {
    const task = await this.getTaskById(taskId, orgId);

    // Soft delete
    await prisma.task.update({
      where: { id: task.id },
      data: { deletedAt: new Date() }
    });

    return { success: true, message: 'Task deleted successfully' };
  }

  async assignUser(taskId: string, targetUserId: string, assignerId: string, orgId: string) {
    const task = await this.getTaskById(taskId, orgId);

    // Verify assigned user belongs to the SAME organization
    const targetMembership = await prisma.orgMember.findUnique({
      where: {
        org_user_unique: {
          organizationId: orgId,
          userId: targetUserId
        }
      },
      include: {
        user: true
      }
    });

    if (!targetMembership) {
      throw new BadRequestError('Assigned user must belong to the same organization as the task', 'INVALID_ASSIGNEE');
    }

    // Check if already assigned
    const existingAssignment = await prisma.taskAssignment.findUnique({
      where: {
        task_user_assignment_unique: {
          taskId: task.id,
          userId: targetUserId
        }
      }
    });

    if (existingAssignment) {
      throw new ConflictError('User is already assigned to this task', 'ALREADY_ASSIGNED');
    }

    // Persist assignment
    const assignment = await prisma.taskAssignment.create({
      data: {
        taskId: task.id,
        userId: targetUserId,
        assignedById: assignerId
      },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true }
        },
        assigner: {
          select: { id: true, email: true, firstName: true, lastName: true }
        }
      }
    });

    // Enqueue background email job asynchronously and trigger in-app notification & audit log
    let jobId: string | null = null;
    try {
      const { notificationService } = await import('../notifications/notification.service');
      const { auditService } = await import('../audit/audit.service');

      const assignerDisplay = assignment.assigner ? `${assignment.assigner.firstName} ${assignment.assigner.lastName}` : 'A manager';

      await notificationService.createNotification({
        userId: targetMembership.user.id,
        orgId,
        type: 'TASK_ASSIGNED',
        title: `Assigned to Task: ${task.title}`,
        message: `${assignerDisplay} assigned you to task "${task.title}".`,
        data: { taskId: task.id, projectId: task.projectId }
      });

      await auditService.logActivity({
        orgId,
        userId: assignerId,
        projectId: task.projectId,
        taskId: task.id,
        action: 'TASK_ASSIGNED',
        entityType: 'TASK',
        metadata: { assigneeId: targetMembership.user.id, assigneeName: `${targetMembership.user.firstName} ${targetMembership.user.lastName}` }
      });

      const job = await enqueueTaskAssignmentEmail({
        taskId: task.id,
        taskTitle: task.title,
        assigneeId: targetMembership.user.id,
        assigneeEmail: targetMembership.user.email,
        assigneeName: `${targetMembership.user.firstName} ${targetMembership.user.lastName}`,
        assignerName: assignerDisplay,
        projectName: task.project.name,
        orgId,
        assignedAt: assignment.assignedAt.toISOString()
      });
      jobId = job.id ? String(job.id) : null;
    } catch (enqueueError) {
      console.error('Non-fatal: Failed to enqueue email job for task assignment:', enqueueError);
    }

    return {
      assignment,
      jobId,
      message: 'Task assigned successfully. Email notification enqueued.'
    };
  }

  async unassignUser(taskId: string, targetUserId: string, orgId: string) {
    const task = await this.getTaskById(taskId, orgId);

    const assignment = await prisma.taskAssignment.findUnique({
      where: {
        task_user_assignment_unique: {
          taskId: task.id,
          userId: targetUserId
        }
      }
    });

    if (!assignment) {
      throw new NotFoundError('Task assignment not found', 'ASSIGNMENT_NOT_FOUND');
    }

    await prisma.taskAssignment.delete({
      where: { id: assignment.id }
    });

    return { success: true, message: 'User unassigned from task successfully' };
  }

  async bulkUpdateStatus(taskIds: string[], status: TaskStatus, orgId: string) {
    // Ensure all tasks belong to the organization
    const validTasks = await prisma.task.findMany({
      where: {
        id: { in: taskIds },
        deletedAt: null,
        project: {
          organizationId: orgId,
          deletedAt: null
        }
      },
      select: { id: true }
    });

    const validIds = validTasks.map((t) => t.id);

    if (validIds.length === 0) {
      throw new NotFoundError('No matching tasks found in your organization', 'NO_TASKS_FOUND');
    }

    const updateResult = await prisma.task.updateMany({
      where: { id: { in: validIds } },
      data: { status }
    });

    return {
      updatedCount: updateResult.count,
      taskIds: validIds,
      status
    };
  }
}

export const taskService = new TaskService();
