import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../common/errors/AppError';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  // 1. Handled AppError instances
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      details: err.details || {}
    });
  }

  // 2. Zod Validation Errors
  if (err instanceof ZodError) {
    const formattedDetails: Record<string, string[]> = {};
    err.errors.forEach((e) => {
      const field = e.path.join('.') || 'root';
      if (!formattedDetails[field]) {
        formattedDetails[field] = [];
      }
      formattedDetails[field].push(e.message);
    });

    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: formattedDetails
    });
  }

  // 3. JWT Token Errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid token',
      code: 'INVALID_TOKEN',
      details: {}
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token has expired',
      code: 'TOKEN_EXPIRED',
      details: {}
    });
  }

  // 4. Rate Limit Errors (from express-rate-limit)
  if (err.status === 429) {
    return res.status(429).json({
      error: 'Too many requests, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
      details: {}
    });
  }

  // 5. Unhandled Exceptions (do not leak stack trace in production)
  console.error('Unhandled Exception:', err);

  return res.status(500).json({
    error: 'An internal server error occurred',
    code: 'INTERNAL_SERVER_ERROR',
    details: process.env.NODE_ENV === 'development' ? { message: err.message } : {}
  });
}
