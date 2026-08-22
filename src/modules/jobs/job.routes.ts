import { Router } from 'express';
import { jobController } from './job.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

// Job status endpoint (GET /jobs/:id)
router.get('/:id', authenticate, jobController.getJob);

export const jobRouter = router;
