import { Router } from 'express';
import { commentController } from './comment.controller';
import { authenticate } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { createCommentSchema } from '../../common/validators';

const router = Router({ mergeParams: true });

router.use(authenticate);

router.post('/', validateBody(createCommentSchema), commentController.addComment);
router.get('/', commentController.listComments);
router.delete('/:id', commentController.deleteComment);

export const commentRouter = router;
