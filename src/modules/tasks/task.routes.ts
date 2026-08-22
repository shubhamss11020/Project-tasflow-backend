import { Router } from 'express';
import { taskController } from './task.controller';
import { authenticate } from '../../middleware/auth';
import { validateBody, validateQuery } from '../../middleware/validate';
import {
  createTaskSchema,
  updateTaskSchema,
  taskQueryFilterSchema,
  bulkUpdateTaskStatusSchema,
  assignTaskSchema
} from '../../common/validators';

const router = Router();

router.use(authenticate);

router.get('/', validateQuery(taskQueryFilterSchema), taskController.listTasks);
router.post('/', validateBody(createTaskSchema), taskController.createTask);
router.patch('/bulk-status', validateBody(bulkUpdateTaskStatusSchema), taskController.bulkUpdateStatus);
router.get('/:id', taskController.getTask);
router.put('/:id', validateBody(updateTaskSchema), taskController.updateTask);
router.patch('/:id', validateBody(updateTaskSchema), taskController.updateTask);
router.delete('/:id', taskController.deleteTask);
router.post('/:id/assign', validateBody(assignTaskSchema), taskController.assignUser);
router.post('/:id/unassign', validateBody(assignTaskSchema), taskController.unassignUser);
router.delete('/:id/assign/:userId', taskController.unassignUser);

export const taskRouter = router;
