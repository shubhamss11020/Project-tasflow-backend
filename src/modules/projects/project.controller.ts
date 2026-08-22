import { Request, Response, NextFunction } from 'express';
import { projectService } from './project.service';

export class ProjectController {
  async listProjects(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.user!.orgId;
      const projects = await projectService.listProjects(orgId);
      return res.status(200).json({ data: projects });
    } catch (error) {
      next(error);
    }
  }

  async getProject(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.user!.orgId;
      const { id } = req.params;
      const project = await projectService.getProjectById(id, orgId);
      return res.status(200).json({ data: project });
    } catch (error) {
      next(error);
    }
  }

  async createProject(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.user!.orgId;
      const userId = req.user!.userId;
      const project = await projectService.createProject(orgId, userId, req.body);
      return res.status(201).json({ data: project });
    } catch (error) {
      next(error);
    }
  }

  async updateProject(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.user!.orgId;
      const { id } = req.params;
      const project = await projectService.updateProject(id, orgId, req.body);
      return res.status(200).json({ data: project });
    } catch (error) {
      next(error);
    }
  }

  async deleteProject(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.user!.orgId;
      const { id } = req.params;
      const result = await projectService.deleteProject(id, orgId);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getProjectDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.user!.orgId;
      const { id } = req.params;
      const dashboard = await projectService.getProjectDashboard(id, orgId);
      return res.status(200).json({ data: dashboard });
    } catch (error) {
      next(error);
    }
  }
}

export const projectController = new ProjectController();
