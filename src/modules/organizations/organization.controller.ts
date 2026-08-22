import { Request, Response, NextFunction } from 'express';
import { organizationService } from './organization.service';

export class OrganizationController {
  async getMembers(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.user!.orgId;
      const members = await organizationService.getMembers(orgId);
      return res.status(200).json({ data: members });
    } catch (error) {
      next(error);
    }
  }

  async addMember(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.user!.orgId;
      const member = await organizationService.addMember(orgId, req.body);
      return res.status(201).json({ data: member });
    } catch (error) {
      next(error);
    }
  }

  async removeMember(req: Request, res: Response, next: NextFunction) {
    try {
      const orgId = req.user!.orgId;
      const currentUserId = req.user!.userId;
      const { memberId } = req.params;
      const result = await organizationService.removeMember(orgId, memberId, currentUserId);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const organizationController = new OrganizationController();
