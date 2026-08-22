import {
  createTaskSchema,
  createProjectSchema,
  registerSchema,
  bulkUpdateTaskStatusSchema
} from '../../src/common/validators';

describe('Unit Test: Zod Request Validation', () => {
  describe('Register Schema Validation', () => {
    it('should validate valid registration input', async () => {
      const valid = {
        email: 'user@example.com',
        password: 'Password123!',
        firstName: 'John',
        lastName: 'Doe',
        orgName: 'Acme'
      };
      await expect(registerSchema.parseAsync(valid)).resolves.toEqual(valid);
    });

    it('should reject invalid email or short password', async () => {
      const invalid = {
        email: 'invalid-email',
        password: '123',
        firstName: 'John',
        lastName: 'Doe',
        orgName: 'A'
      };
      await expect(registerSchema.parseAsync(invalid)).rejects.toThrow();
    });
  });

  describe('Task Schemas Validation', () => {
    it('should validate correct task creation schema', async () => {
      const valid = {
        projectId: '123e4567-e89b-12d3-a456-426614174000',
        title: 'New API Feature',
        description: 'Detailed description',
        status: 'todo',
        priority: 'high',
        dueDate: '2026-10-01T00:00:00.000Z'
      };
      const parsed = await createTaskSchema.parseAsync(valid);
      expect(parsed.title).toBe(valid.title);
      expect(parsed.status).toBe('todo');
    });

    it('should reject invalid UUID for projectId', async () => {
      const invalid = {
        projectId: 'not-a-uuid',
        title: 'Task'
      };
      await expect(createTaskSchema.parseAsync(invalid)).rejects.toThrow();
    });

    it('should validate bulk update status schema', async () => {
      const valid = {
        taskIds: ['123e4567-e89b-12d3-a456-426614174000'],
        status: 'done'
      };
      const parsed = await bulkUpdateTaskStatusSchema.parseAsync(valid);
      expect(parsed.status).toBe('done');
    });
  });
});
