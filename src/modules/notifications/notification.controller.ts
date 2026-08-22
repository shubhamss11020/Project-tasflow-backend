import { Request, Response, NextFunction } from 'express';
import { notificationService } from './notification.service';

export class NotificationController {
  async getNotifications(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const orgId = req.user!.orgId;
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const unreadOnly = req.query.unreadOnly === 'true';

      const result = await notificationService.getNotifications(userId, orgId, page, limit, unreadOnly);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async markAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const result = await notificationService.markAsRead(id, userId);
      return res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async markAllAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const orgId = req.user!.orgId;
      const result = await notificationService.markAllAsRead(userId, orgId);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const notificationController = new NotificationController();
