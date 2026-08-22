import { Router, Request, Response, NextFunction } from 'express';
import { auditService } from './audit.service';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.use(authenticate);

// GET /tasks/:id/activity
router.get('/tasks/:taskId/activity', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId;
    const { taskId } = req.params;
    const activities = await auditService.getTaskActivity(taskId, orgId);
    return res.status(200).json({ data: activities });
  } catch (error) {
    next(error);
  }
});

// GET /projects/:id/activity
router.get('/projects/:projectId/activity', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.orgId;
    const { projectId } = req.params;
    const activities = await auditService.getProjectActivity(projectId, orgId);
    return res.status(200).json({ data: activities });
  } catch (error) {
    next(error);
  }
});

export const auditRouter = router;
