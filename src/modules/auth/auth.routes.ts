import { Router } from 'express';
import { authController } from './auth.controller';
import { authRateLimiter } from '../../middleware/rateLimiter';
import { validateBody } from '../../middleware/validate';
import { registerSchema, loginSchema, refreshTokenSchema } from '../../common/validators';
import { authenticate } from '../../middleware/auth';

const router = Router();

// Authentication endpoints rate-limited to 10 requests/minute/IP
router.post('/register', authRateLimiter, validateBody(registerSchema), authController.register);
router.post('/login', authRateLimiter, validateBody(loginSchema), authController.login);
router.post('/refresh', authRateLimiter, validateBody(refreshTokenSchema), authController.refresh);
router.post('/logout', authRateLimiter, validateBody(refreshTokenSchema), authController.logout);

// OAuth 2.0 Endpoints (Google & GitHub)
router.post('/oauth/google', authRateLimiter, authController.googleOAuth);
router.post('/oauth/github', authRateLimiter, authController.githubOAuth);

// Authenticated session management (Bonus: Logout all devices)
router.post('/logout-all', authenticate, authController.logoutAll);

export const authRouter = router;
