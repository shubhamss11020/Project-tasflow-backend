import { Request, Response, NextFunction } from 'express';
import { taskService } from './task.service';

export class TaskController {
  async listTasks(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.user!.orgId;
      const filters = req.query;
      const result = await taskService.listTasks(orgId, filters);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getTask(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.user!.orgId;
      const { id } = req.params;
      const task = await taskService.getTaskById(id, orgId);
      return res.status(200).json({ data: task });
    } catch (error) {
      next(error);
    }
  }

  async createTask(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.user!.orgId;
      const userId = req.user!.userId;
      const task = await taskService.createTask(orgId, userId, req.body);
      return res.status(201).json({ data: task });
    } catch (error) {
      next(error);
    }
  }

  async updateTask(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.user!.orgId;
      const updaterId = req.user!.userId;
      const { id } = req.params;
      const task = await taskService.updateTask(id, orgId, req.body, updaterId);
      return res.status(200).json({ data: task });
    } catch (error) {
      next(error);
    }
  }

  async deleteTask(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.user!.orgId;
      const { id } = req.params;
      const result = await taskService.deleteTask(id, orgId);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async assignUser(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.user!.orgId;
      const assignerId = req.user!.userId;
      const { id: taskId } = req.params;
      const { userId: targetUserId } = req.body;
      const result = await taskService.assignUser(taskId, targetUserId, assignerId, orgId);
      return res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async unassignUser(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.user!.orgId;
      const { id: taskId } = req.params;
      const targetUserId = req.body.userId || req.params.userId;
      const result = await taskService.unassignUser(taskId, targetUserId, orgId);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async bulkUpdateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.user!.orgId;
      const { taskIds, status } = req.body;
      const result = await taskService.bulkUpdateStatus(taskIds, status, orgId);
      return res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  }
}

export const taskController = new TaskController();
