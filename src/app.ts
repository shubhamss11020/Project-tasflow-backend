import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { swaggerDocument } from './docs/swaggerDoc';
import { errorHandler } from './middleware/errorHandler';
import { authRouter } from './modules/auth/auth.routes';
import { organizationRouter } from './modules/organizations/organization.routes';
import { projectRouter } from './modules/projects/project.routes';
import { taskRouter } from './modules/tasks/task.routes';
import { commentRouter } from './modules/comments/comment.routes';
import { jobRouter } from './modules/jobs/job.routes';
import { sseRouter } from './modules/events/sse.routes';
import { notificationRouter } from './modules/notifications/notification.routes';
import { auditRouter } from './modules/audit/audit.routes';
import { emailRouter } from './modules/email/email.routes';

export const app = express();

// Enable trust proxy for reverse proxies (Render, AWS, Cloudflare, Nginx)
app.set('trust proxy', 1);

// Security and utility middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Healthcheck endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Swagger UI documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Mount Routers
app.use('/auth', authRouter);
app.use('/organizations', organizationRouter);
app.use('/projects', projectRouter);
app.use('/tasks', taskRouter);
app.use('/tasks/:taskId/comments', commentRouter);
app.use('/jobs', jobRouter);
app.use('/events', sseRouter);
app.use('/notifications', notificationRouter);
app.use('/email', emailRouter);
app.use('/', auditRouter);

// 404 handler for undefined routes
app.use((_req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    code: 'ROUTE_NOT_FOUND',
    details: {}
  });
});

// Global Error Handling Middleware
app.use(errorHandler);
