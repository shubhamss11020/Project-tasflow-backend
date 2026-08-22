import { prisma } from '../../database/prisma';
import { NotFoundError, ConflictError, BadRequestError } from '../../common/errors/AppError';
import { OrgRole } from '@prisma/client';

export class OrganizationService {
  async getMembers(orgId: string) {
    const members = await prisma.orgMember.findMany({
      where: { organizationId: orgId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            createdAt: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    return members.map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      joinedAt: m.createdAt,
      user: m.user
    }));
  }

  async addMember(
    orgId: string,
    payload: {
      userId?: string;
      email?: string;
      password?: string;
      firstName?: string;
      lastName?: string;
      role?: OrgRole;
    }
  ) {
    const role = payload.role || OrgRole.member;
    let targetUserId = payload.userId;

    // If creating a brand new user directly into the organization
    if (!targetUserId && payload.email && payload.password && payload.firstName && payload.lastName) {
      const existingUser = await prisma.user.findUnique({
        where: { email: payload.email.toLowerCase() }
      });

      if (existingUser) {
        targetUserId = existingUser.id;
      } else {
        const { hashPassword } = await import('../../common/utils/password');
        const passwordHash = await hashPassword(payload.password);

        const newUser = await prisma.user.create({
          data: {
            email: payload.email.toLowerCase(),
            passwordHash,
            firstName: payload.firstName,
            lastName: payload.lastName
          }
        });
        targetUserId = newUser.id;
      }
    }

    if (!targetUserId) {
      throw new BadRequestError('User details or valid userId must be provided');
    }

    const existingMember = await prisma.orgMember.findUnique({
      where: {
        org_user_unique: {
          organizationId: orgId,
          userId: targetUserId
        }
      }
    });

    if (existingMember) {
      throw new ConflictError('User is already a member of this organization', 'MEMBER_ALREADY_EXISTS');
    }

    const member = await prisma.orgMember.create({
      data: {
        organizationId: orgId,
        userId: targetUserId,
        role
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        },
        organization: true
      }
    });

    // Fire asynchronous invite notification, email, and audit log
    try {
      const { notificationService } = await import('../notifications/notification.service');
      const { emailService } = await import('../../common/utils/emailService');
      const { auditService } = await import('../audit/audit.service');

      const inviter = payload.userId ? 'An admin' : 'Workspace Admin';
      const inviteHtml = emailService.generateMemberInviteTemplate({
        orgName: member.organization.name,
        inviteeName: `${member.user.firstName} ${member.user.lastName}`,
        inviterName: inviter,
        role: member.role
      });

      await notificationService.createNotification({
        userId: member.userId,
        orgId,
        type: 'MEMBER_INVITED',
        title: `Welcome to ${member.organization.name}!`,
        message: `You have been invited to join ${member.organization.name} on TaskFlow as a ${member.role}.`,
        data: { orgId, role: member.role },
        emailPayload: {
          to: member.user.email,
          subject: `You're Invited to Join ${member.organization.name} on TaskFlow`,
          html: inviteHtml
        }
      });

      await auditService.logActivity({
        orgId,
        userId: member.userId,
        action: 'MEMBER_INVITED',
        entityType: 'MEMBER',
        metadata: { role: member.role, email: member.user.email }
      });
    } catch (notifyErr) {
      console.error('Non-fatal: Failed to dispatch member invite notification:', notifyErr);
    }

    return member;
  }

  async removeMember(orgId: string, memberId: string, currentUserId: string) {
    const member = await prisma.orgMember.findUnique({
      where: { id: memberId }
    });

    if (!member || member.organizationId !== orgId) {
      throw new NotFoundError('Organization member not found', 'MEMBER_NOT_FOUND');
    }

    if (member.userId === currentUserId) {
      throw new BadRequestError('Cannot remove yourself from the organization', 'CANNOT_REMOVE_SELF');
    }

    await prisma.orgMember.delete({
      where: { id: memberId }
    });

    return { success: true, message: 'Member removed successfully' };
  }
}

export const organizationService = new OrganizationService();
