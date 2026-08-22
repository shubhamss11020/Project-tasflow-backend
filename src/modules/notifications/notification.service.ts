import { prisma } from '../../database/prisma';
import { NotificationType } from '@prisma/client';
import { sseService } from '../events/sse.service';
import { NotFoundError } from '../../common/errors/AppError';
import { emailQueue } from '../../queues/emailQueue';

export interface CreateNotificationParams {
  userId: string;
  orgId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  emailPayload?: {
    to: string;
    subject: string;
    html: string;
  };
}

export class NotificationService {
  async createNotification(params: CreateNotificationParams) {
    // 1. Persist notification in database
    const notification = await prisma.notification.create({
      data: {
        userId: params.userId,
        orgId: params.orgId,
        type: params.type,
        title: params.title,
        message: params.message,
        data: params.data || {}
      }
    });

    // 2. Real-time push via SSE
    sseService.sendToUser(params.orgId, params.userId, 'notification', {
      ...notification,
      unreadCountUpdate: true
    });

    // 3. Enqueue background email job if email payload provided
    if (params.emailPayload) {
      try {
        await emailQueue.add('sendEmailNotification', {
          type: params.type,
          to: params.emailPayload.to,
          subject: params.emailPayload.subject,
          html: params.emailPayload.html,
          metadata: params.data
        });
      } catch (err) {
        console.error('Failed to enqueue email notification:', err);
      }
    }

    return notification;
  }

  async getNotifications(userId: string, orgId: string, page = 1, limit = 20, unreadOnly = false) {
    const where: any = { userId, orgId };
    if (unreadOnly) {
      where.isRead = false;
    }

    const skip = (page - 1) * limit;

    const [total, unreadCount, notifications] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, orgId, isRead: false } }),
      prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      })
    ]);

    return {
      data: notifications,
      unreadCount,
      total,
      page,
      limit
    };
  }

  async markAsRead(notificationId: string, userId: string) {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId }
    });

    if (!notification || notification.userId !== userId) {
      throw new NotFoundError('Notification not found');
    }

    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true }
    });

    return updated;
  }

  async markAllAsRead(userId: string, orgId: string) {
    await prisma.notification.updateMany({
      where: { userId, orgId, isRead: false },
      data: { isRead: true }
    });

    return { success: true, message: 'All notifications marked as read' };
  }
}

export const notificationService = new NotificationService();
