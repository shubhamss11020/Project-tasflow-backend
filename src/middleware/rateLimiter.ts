import rateLimit from 'express-rate-limit';

export const authRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per windowMs per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many authentication requests from this IP, please try again after a minute',
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
    details: {}
  }
});
