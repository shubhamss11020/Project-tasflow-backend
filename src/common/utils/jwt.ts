import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../../config';
import { OrgRole } from '@prisma/client';

export interface JwtPayload {
  userId: string;
  email: string;
  orgId: string;
  role: OrgRole;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenId: string;
  familyId: string;
}

export function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: '15m'
  });
}

export function generateRefreshTokenPayload(userId: string, familyId?: string) {
  const tokenId = crypto.randomUUID();
  const activeFamilyId = familyId || crypto.randomUUID();
  const token = jwt.sign(
    { userId, tokenId, familyId: activeFamilyId },
    config.jwt.refreshSecret,
    { expiresIn: `${config.jwt.refreshTtlDays}d` }
  );

  const tokenHash = hashToken(token);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + config.jwt.refreshTtlDays);

  return {
    rawToken: token,
    tokenId,
    tokenHash,
    familyId: activeFamilyId,
    expiresAt
  };
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwt.accessSecret) as JwtPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, config.jwt.refreshSecret) as RefreshTokenPayload;
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
