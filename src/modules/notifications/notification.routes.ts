import { Router } from 'express';
import { notificationController } from './notification.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', notificationController.getNotifications);
router.patch('/read-all', notificationController.markAllAsRead);
router.patch('/:id/read', notificationController.markAsRead);

export const notificationRouter = router;
