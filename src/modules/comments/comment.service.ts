import { prisma } from '../../database/prisma';
import { NotFoundError, ForbiddenError } from '../../common/errors/AppError';
import { taskService } from '../tasks/task.service';
import { OrgRole } from '@prisma/client';

export class CommentService {
  async addComment(taskId: string, userId: string, orgId: string, content: string) {
    // Check if task exists and belongs to current org
    const task = await taskService.getTaskById(taskId, orgId);

    const comment = await prisma.comment.create({
      data: {
        taskId,
        userId,
        content
      },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    try {
      const { notificationService } = await import('../notifications/notification.service');
      const { emailService } = await import('../../common/utils/emailService');
      const { auditService } = await import('../audit/audit.service');

      const authorName = `${comment.author.firstName} ${comment.author.lastName}`;

      // Notify all assignees who are not the comment author
      for (const assign of task.assignments) {
        if (assign.user.id !== userId) {
          const commentHtml = emailService.generateCommentTemplate({
            taskTitle: task.title,
            taskId: task.id,
            authorName,
            commentContent: content
          });

          await notificationService.createNotification({
            userId: assign.user.id,
            orgId,
            type: 'COMMENT_ADDED',
            title: `New Comment on "${task.title}"`,
            message: `${authorName} commented: "${content.slice(0, 80)}${content.length > 80 ? '...' : ''}"`,
            data: { taskId: task.id, commentId: comment.id },
            emailPayload: {
              to: assign.user.email,
              subject: `New Comment on "${task.title}" by ${authorName}`,
              html: commentHtml
            }
          });
        }
      }

      await auditService.logActivity({
        orgId,
        userId,
        projectId: task.project.id,
        taskId: task.id,
        action: 'COMMENT_ADDED',
        entityType: 'COMMENT',
        metadata: { snippet: content.slice(0, 50) }
      });
    } catch (err) {
      console.error('Non-fatal: Failed to dispatch comment notification:', err);
    }

    return comment;
  }

  async listComments(taskId: string, orgId: string) {
    await taskService.getTaskById(taskId, orgId);

    return prisma.comment.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
      include: {
        author: {
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

  async deleteComment(commentId: string, userId: string, orgId: string, role: OrgRole) {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        task: {
          include: { project: true }
        }
      }
    });

    if (!comment) {
      throw new NotFoundError('Comment not found', 'COMMENT_NOT_FOUND');
    }

    if (comment.task.project.organizationId !== orgId) {
      throw new ForbiddenError('Access denied to comment from another organization');
    }

    if (comment.userId !== userId && role !== OrgRole.org_admin) {
      throw new ForbiddenError('You can only delete your own comments unless you are an admin');
    }

    await prisma.comment.delete({
      where: { id: commentId }
    });

    return { success: true, message: 'Comment deleted successfully' };
  }
}

export const commentService = new CommentService();
