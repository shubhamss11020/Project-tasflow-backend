import { OrgRole } from '@prisma/client';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  orgId: string;
  role: OrgRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
