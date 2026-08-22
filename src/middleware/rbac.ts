import { Request, Response, NextFunction } from 'express';
import { OrgRole } from '@prisma/client';
import { ForbiddenError, UnauthorizedError } from '../common/errors/AppError';

export function requireRole(allowedRoles: OrgRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Action requires one of the following roles: [${allowedRoles.join(', ')}]. Current role: ${req.user.role}`
        )
      );
    }

    next();
  };
}
