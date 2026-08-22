import { Request, Response, NextFunction } from 'express';
import { commentService } from './comment.service';

export class CommentController {
  async addComment(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.user!.orgId;
      const userId = req.user!.userId;
      const { taskId } = req.params;
      const { content } = req.body;
      const comment = await commentService.addComment(taskId, userId, orgId, content);
      return res.status(201).json({ data: comment });
    } catch (error) {
      next(error);
    }
  }

  async listComments(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.user!.orgId;
      const { taskId } = req.params;
      const comments = await commentService.listComments(taskId, orgId);
      return res.status(200).json({ data: comments });
    } catch (error) {
      next(error);
    }
  }

  async deleteComment(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.user!.orgId;
      const userId = req.user!.userId;
      const role = req.user!.role;
      const { id } = req.params;
      const result = await commentService.deleteComment(id, userId, orgId, role);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const commentController = new CommentController();
