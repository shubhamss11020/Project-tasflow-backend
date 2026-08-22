import { prisma } from '../../database/prisma';
import { generateAccessToken, generateRefreshTokenPayload } from '../../common/utils/jwt';
import { BadRequestError } from '../../common/errors/AppError';
import { OrgRole } from '@prisma/client';

export interface OAuthLoginInput {
  provider: 'google' | 'github';
  token?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  oauthId?: string;
  orgName?: string;
}

export class OAuthService {
  async handleOAuthLogin(input: OAuthLoginInput, meta?: { userAgent?: string; ipAddress?: string }) {
    let email = input.email;
    let firstName = input.firstName || 'OAuth';
    let lastName = input.lastName || 'User';
    let oauthId = input.oauthId || `oauth_${Date.now()}`;

    // If token provided and it's Google, attempt live Google userinfo fetch
    if (input.token && input.provider === 'google' && !input.email) {
      try {
        const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${input.token}` }
        });
        if (response.ok) {
          const profile: any = await response.json();
          email = profile.email;
          firstName = profile.given_name || firstName;
          lastName = profile.family_name || lastName;
          oauthId = profile.sub || oauthId;
        }
      } catch {
        // Continue with input data if network/dev mock
      }
    }

    // If token provided and it's GitHub, attempt live GitHub userinfo fetch
    if (input.token && input.provider === 'github' && !input.email) {
      try {
        const response = await fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${input.token}`,
            'User-Agent': 'TaskFlow-App'
          }
        });
        if (response.ok) {
          const profile: any = await response.json();
          email = profile.email || `${profile.login}@github.oauth`;
          firstName = (profile.name || profile.login).split(' ')[0] || firstName;
          lastName = (profile.name || '').split(' ').slice(1).join(' ') || lastName;
          oauthId = String(profile.id);
        }
      } catch {
        // Continue with input data
      }
    }

    if (!email) {
      throw new BadRequestError('Email could not be resolved from OAuth provider');
    }

    // Find or create user
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email.toLowerCase() },
          { oauthProvider: input.provider, oauthId }
        ]
      },
      include: {
        orgMemberships: {
          include: { organization: true }
        }
      }
    });

    let activeOrgId: string;
    let activeOrgName: string;
    let activeOrgSlug: string;
    let role: OrgRole = OrgRole.org_admin;

    if (!user) {
      // Create new user and default organization
      const orgName = input.orgName || `${firstName}'s Workspace`;
      const slugBase = orgName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
      const slug = `${slugBase}-${Date.now().toString().slice(-4)}`;

      const created = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            email: email!.toLowerCase(),
            firstName,
            lastName,
            oauthProvider: input.provider,
            oauthId
          }
        });

        const newOrg = await tx.organization.create({
          data: {
            name: orgName,
            slug
          }
        });

        await tx.orgMember.create({
          data: {
            organizationId: newOrg.id,
            userId: newUser.id,
            role: OrgRole.org_admin
          }
        });

        return { user: newUser, org: newOrg };
      });

      user = { ...created.user, orgMemberships: [{ organization: created.org, role: OrgRole.org_admin } as any] } as any;
      activeOrgId = created.org.id;
      activeOrgName = created.org.name;
      activeOrgSlug = created.org.slug;
    } else {
      // Link OAuth if not already linked
      if (!user.oauthProvider) {
        await prisma.user.update({
          where: { id: user.id },
          data: { oauthProvider: input.provider, oauthId }
        });
      }

      const primaryMembership = user.orgMemberships[0];
      if (!primaryMembership) {
        throw new BadRequestError('User has no organization membership');
      }

      activeOrgId = primaryMembership.organization.id;
      activeOrgName = primaryMembership.organization.name;
      activeOrgSlug = primaryMembership.organization.slug;
      role = primaryMembership.role;
    }

    // Issue tokens
    const accessToken = generateAccessToken({
      userId: user!.id,
      email: user!.email,
      orgId: activeOrgId,
      role
    });

    const refresh = generateRefreshTokenPayload(user!.id);
    await prisma.refreshToken.create({
      data: {
        userId: user!.id,
        tokenHash: refresh.tokenHash,
        familyId: refresh.familyId,
        expiresAt: refresh.expiresAt,
        userAgent: meta?.userAgent,
        ipAddress: meta?.ipAddress
      }
    });

    return {
      user: {
        id: user!.id,
        email: user!.email,
        firstName: user!.firstName,
        lastName: user!.lastName,
        oauthProvider: input.provider
      },
      organization: {
        id: activeOrgId,
        name: activeOrgName,
        slug: activeOrgSlug,
        role
      },
      tokens: {
        accessToken,
        refreshToken: refresh.rawToken
      }
    };
  }
}

export const oauthService = new OAuthService();
