import { Router } from 'express';
import { organizationController } from './organization.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { addOrgMemberSchema } from '../../common/validators';
import { OrgRole } from '@prisma/client';

const router = Router();

router.use(authenticate);

router.get('/members', organizationController.getMembers);
router.post('/members', requireRole([OrgRole.org_admin]), validateBody(addOrgMemberSchema), organizationController.addMember);
router.delete('/members/:memberId', requireRole([OrgRole.org_admin]), organizationController.removeMember);

export const organizationRouter = router;
