import { hashPassword, comparePassword } from '../../src/common/utils/password';
import {
  generateAccessToken,
  verifyAccessToken,
  generateRefreshTokenPayload,
  verifyRefreshToken,
  hashToken
} from '../../src/common/utils/jwt';
import { OrgRole } from '@prisma/client';

describe('Unit Test: Authentication & Cryptography Logic', () => {
  describe('Password Hashing (bcrypt cost >= 12)', () => {
    it('should hash passwords securely and verify correct password', async () => {
      const password = 'StrongPassword123!';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toEqual(password);
      // bcrypt hashes starting with $2a$ or $2b$ with cost 12
      expect(hash).toMatch(/^\$2[ab]\$12\$/);

      const isValid = await comparePassword(password, hash);
      expect(isValid).toBe(true);

      const isInvalid = await comparePassword('WrongPassword', hash);
      expect(isInvalid).toBe(false);
    });
  });

  describe('JWT Access Token Lifecycle', () => {
    it('should sign and verify valid JWT access tokens with user & org context', () => {
      const payload = {
        userId: 'u-12345',
        email: 'tester@acme.com',
        orgId: 'org-98765',
        role: OrgRole.org_admin
      };

      const token = generateAccessToken(payload);
      expect(typeof token).toBe('string');

      const verified = verifyAccessToken(token);
      expect(verified.userId).toBe(payload.userId);
      expect(verified.email).toBe(payload.email);
      expect(verified.orgId).toBe(payload.orgId);
      expect(verified.role).toBe(payload.role);
    });

    it('should fail verification for tampered tokens', () => {
      const token = generateAccessToken({
        userId: 'u-123',
        email: 'test@example.com',
        orgId: 'org-123',
        role: OrgRole.member
      });

      const tamperedToken = token.slice(0, -5) + 'xxxxx';
      expect(() => verifyAccessToken(tamperedToken)).toThrow();
    });
  });

  describe('Refresh Token Generation & Hashing', () => {
    it('should generate refresh token payload with familyId and hash', () => {
      const userId = 'u-user-001';
      const refresh = generateRefreshTokenPayload(userId);

      expect(refresh.rawToken).toBeDefined();
      expect(refresh.tokenId).toBeDefined();
      expect(refresh.familyId).toBeDefined();
      expect(refresh.tokenHash).toBeDefined();
      expect(refresh.expiresAt.getTime()).toBeGreaterThan(Date.now());

      const verified = verifyRefreshToken(refresh.rawToken);
      expect(verified.userId).toBe(userId);
      expect(verified.familyId).toBe(refresh.familyId);

      const computedHash = hashToken(refresh.rawToken);
      expect(computedHash).toEqual(refresh.tokenHash);
    });
  });
});
