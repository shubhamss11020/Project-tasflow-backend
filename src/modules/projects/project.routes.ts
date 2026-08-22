import { Router } from 'express';
import { projectController } from './project.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { createProjectSchema, updateProjectSchema } from '../../common/validators';
import { OrgRole } from '@prisma/client';

const router = Router();

router.use(authenticate);

router.get('/', projectController.listProjects);
router.post('/', validateBody(createProjectSchema), projectController.createProject);
router.get('/:id', projectController.getProject);
router.put('/:id', validateBody(updateProjectSchema), projectController.updateProject);
router.patch('/:id', validateBody(updateProjectSchema), projectController.updateProject);
router.delete('/:id', requireRole([OrgRole.org_admin]), projectController.deleteProject);
router.get('/:id/dashboard', projectController.getProjectDashboard);

export const projectRouter = router;
