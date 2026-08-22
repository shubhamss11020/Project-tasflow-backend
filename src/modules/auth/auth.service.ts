import { prisma } from '../../database/prisma';
import { hashPassword, comparePassword } from '../../common/utils/password';
import {
  generateAccessToken,
  generateRefreshTokenPayload,
  verifyRefreshToken,
  hashToken
} from '../../common/utils/jwt';
import {
  ConflictError,
  UnauthorizedError,
  NotFoundError,
  BadRequestError
} from '../../common/errors/AppError';
import { OrgRole } from '@prisma/client';

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  orgName: string;
}

export interface LoginInput {
  email: string;
  password: string;
  orgId?: string;
}

export class AuthService {
  async register(input: RegisterInput, meta?: { userAgent?: string; ipAddress?: string }) {
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() }
    });

    if (existingUser) {
      throw new ConflictError('User with this email already exists', 'USER_ALREADY_EXISTS');
    }

    const passwordHash = await hashPassword(input.password);

    // Create organization and user within a transaction
    const slugBase = input.orgName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    const slug = `${slugBase}-${Date.now().toString().slice(-4)}`;

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email.toLowerCase(),
          passwordHash,
          firstName: input.firstName,
          lastName: input.lastName
        }
      });

      const org = await tx.organization.create({
        data: {
          name: input.orgName,
          slug
        }
      });

      await tx.orgMember.create({
        data: {
          organizationId: org.id,
          userId: user.id,
          role: OrgRole.org_admin
        }
      });

      return { user, org };
    });

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: result.user.id,
      email: result.user.email,
      orgId: result.org.id,
      role: OrgRole.org_admin
    });

    const refresh = generateRefreshTokenPayload(result.user.id);
    await prisma.refreshToken.create({
      data: {
        userId: result.user.id,
        tokenHash: refresh.tokenHash,
        familyId: refresh.familyId,
        expiresAt: refresh.expiresAt,
        userAgent: meta?.userAgent,
        ipAddress: meta?.ipAddress
      }
    });

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName
      },
      organization: {
        id: result.org.id,
        name: result.org.name,
        slug: result.org.slug,
        role: OrgRole.org_admin
      },
      tokens: {
        accessToken,
        refreshToken: refresh.rawToken
      }
    };
  }

  async login(input: LoginInput, meta?: { userAgent?: string; ipAddress?: string }) {
    const user = await prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
      include: {
        orgMemberships: {
          include: {
            organization: true
          }
        }
      }
    });

    if (!user) {
      throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedError('Account was registered via OAuth. Please sign in with Google or GitHub.', 'OAUTH_ACCOUNT');
    }

    const isPasswordValid = await comparePassword(input.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    if (!user.orgMemberships.length) {
      throw new UnauthorizedError('User is not associated with any organization', 'NO_ORG_MEMBERSHIP');
    }

    // Select organization
    let selectedMembership = user.orgMemberships[0];
    if (input.orgId) {
      const match = user.orgMemberships.find((m) => m.organizationId === input.orgId);
      if (!match) {
        throw new UnauthorizedError('User is not a member of the requested organization', 'INVALID_ORGANIZATION');
      }
      selectedMembership = match;
    }

    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      orgId: selectedMembership.organizationId,
      role: selectedMembership.role
    });

    const refresh = generateRefreshTokenPayload(user.id);
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refresh.tokenHash,
        familyId: refresh.familyId,
        expiresAt: refresh.expiresAt,
        userAgent: meta?.userAgent,
        ipAddress: meta?.ipAddress
      }
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      },
      organization: {
        id: selectedMembership.organization.id,
        name: selectedMembership.organization.name,
        slug: selectedMembership.organization.slug,
        role: selectedMembership.role
      },
      tokens: {
        accessToken,
        refreshToken: refresh.rawToken
      }
    };
  }

  async refresh(refreshTokenRaw: string, meta?: { userAgent?: string; ipAddress?: string }) {
    let payload;
    try {
      payload = verifyRefreshToken(refreshTokenRaw);
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
    }

    const rawHash = hashToken(refreshTokenRaw);
    const existingToken = await prisma.refreshToken.findUnique({
      where: { tokenHash: rawHash }
    });

    if (!existingToken) {
      throw new UnauthorizedError('Refresh token record not found', 'REFRESH_TOKEN_NOT_FOUND');
    }

    // Token Reuse Detection (Revocation family protection)
    if (existingToken.isRevoked) {
      // Invalidate all tokens in this family because of potential token theft!
      await prisma.refreshToken.updateMany({
        where: { familyId: existingToken.familyId },
        data: { isRevoked: true }
      });
      throw new UnauthorizedError('Revoked token reuse detected. All sessions in family terminated.', 'TOKEN_THEFT_DETECTED');
    }

    if (existingToken.expiresAt < new Date()) {
      throw new UnauthorizedError('Refresh token expired', 'REFRESH_TOKEN_EXPIRED');
    }

    // Find user and default organization membership
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        orgMemberships: {
          include: { organization: true }
        }
      }
    });

    if (!user || !user.orgMemberships.length) {
      throw new UnauthorizedError('User or organization membership no longer exists');
    }

    const activeMembership = user.orgMemberships[0];

    // Refresh Token Rotation: Revoke current token and generate new one
    const newRefresh = generateRefreshTokenPayload(user.id, existingToken.familyId);

    await prisma.$transaction([
      prisma.refreshToken.update({
        where: { id: existingToken.id },
        data: {
          isRevoked: true,
          replacedByToken: newRefresh.tokenHash
        }
      }),
      prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: newRefresh.tokenHash,
          familyId: existingToken.familyId,
          expiresAt: newRefresh.expiresAt,
          userAgent: meta?.userAgent,
          ipAddress: meta?.ipAddress
        }
      })
    ]);

    const newAccessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      orgId: activeMembership.organizationId,
      role: activeMembership.role
    });

    return {
      tokens: {
        accessToken: newAccessToken,
        refreshToken: newRefresh.rawToken
      }
    };
  }

  async logout(refreshTokenRaw: string) {
    const rawHash = hashToken(refreshTokenRaw);
    await prisma.refreshToken.updateMany({
      where: { tokenHash: rawHash },
      data: { isRevoked: true }
    });
    return { success: true };
  }

  async logoutAll(userId: string) {
    await prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true }
    });
    return { success: true, message: 'All active sessions revoked' };
  }
}

export const authService = new AuthService();
