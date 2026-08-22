import { Router, Request, Response } from 'express';
import { sseService } from './sse.service';
import { verifyAccessToken } from '../../common/utils/jwt';
import { UnauthorizedError } from '../../common/errors/AppError';

const router = Router();

// SSE Stream Endpoint (supports auth via Bearer header or ?token= query for EventSource in browser)
router.get('/stream', (req: Request, res: Response) => {
  let token = req.query.token as string;
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    throw new UnauthorizedError('Authentication token required to connect to SSE stream');
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw new UnauthorizedError('Invalid or expired token for SSE stream');
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send initial connection confirmation event
  res.write(`event: connected\ndata: ${JSON.stringify({ message: 'Connected to TaskFlow real-time events', userId: payload.userId, orgId: payload.orgId })}\n\n`);

  sseService.addClient(payload.orgId, payload.userId, res);
});

export const sseRouter = router;
