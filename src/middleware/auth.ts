import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../common/utils/jwt';
import { UnauthorizedError } from '../common/errors/AppError';
import { prisma } from '../database/prisma';

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or malformed Authorization header');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new UnauthorizedError('Bearer token is empty');
    }

    const payload = verifyAccessToken(token);

    // Optional fast verification against database if membership was altered
    const membership = await prisma.orgMember.findUnique({
      where: {
        org_user_unique: {
          organizationId: payload.orgId,
          userId: payload.userId
        }
      }
    });

    if (!membership) {
      throw new UnauthorizedError('User does not belong to the token organization');
    }

    req.user = {
      userId: payload.userId,
      email: payload.email,
      orgId: payload.orgId,
      role: membership.role
    };

    next();
  } catch (error) {
    next(error);
  }
}
