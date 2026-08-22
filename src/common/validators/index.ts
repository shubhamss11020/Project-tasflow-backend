import { z } from 'zod';
import { OrgRole, TaskStatus, TaskPriority } from '@prisma/client';

// Auth Schemas
export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  orgName: z.string().min(2, 'Organization name must be at least 2 characters long')
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  orgId: z.string().uuid('Invalid organization ID format').optional()
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required')
});

// Project Schemas
export const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100, 'Project name too long'),
  description: z.string().max(1000, 'Description too long').optional()
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional().nullable()
});

// Task Schemas
export const taskStatusEnum = z.enum(['todo', 'in_progress', 'review', 'done'] as const);
export const taskPriorityEnum = z.enum(['low', 'medium', 'high', 'urgent'] as const);

export const createTaskSchema = z.object({
  projectId: z.string().uuid('Invalid project ID format'),
  title: z.string().min(1, 'Task title is required').max(200, 'Title too long'),
  description: z.string().max(5000, 'Description too long').optional(),
  status: taskStatusEnum.optional().default('todo'),
  priority: taskPriorityEnum.optional().default('medium'),
  dueDate: z.string().datetime({ message: 'Invalid ISO date-time string' }).optional().nullable()
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional().nullable(),
  status: taskStatusEnum.optional(),
  priority: taskPriorityEnum.optional(),
  dueDate: z.string().datetime({ message: 'Invalid ISO date-time string' }).optional().nullable()
});

export const bulkUpdateTaskStatusSchema = z.object({
  taskIds: z.array(z.string().uuid('Invalid task ID format')).min(1, 'At least one task ID required'),
  status: taskStatusEnum
});

export const assignTaskSchema = z.object({
  userId: z.string().uuid('Invalid user ID format')
});

export const taskQueryFilterSchema = z.object({
  status: taskStatusEnum.optional(),
  priority: taskPriorityEnum.optional(),
  assigneeId: z.string().uuid().optional(),
  dueDateStart: z.string().datetime().optional(),
  dueDateEnd: z.string().datetime().optional(),
  search: z.string().optional(),
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  cursor: z.string().optional()
});

// Comment Schemas
export const createCommentSchema = z.object({
  content: z.string().min(1, 'Comment content cannot be empty').max(2000, 'Comment too long')
});

// Org Member Management Schema (supports either existing userId or creating new user directly)
export const addOrgMemberSchema = z
  .object({
    userId: z.string().uuid('Invalid user ID format').optional(),
    email: z.string().email('Invalid email address').optional(),
    password: z.string().min(8, 'Password must be at least 8 characters long').optional(),
    firstName: z.string().min(1, 'First name is required').optional(),
    lastName: z.string().min(1, 'Last name is required').optional(),
    role: z.enum(['org_admin', 'member'] as const).default('member')
  })
  .refine((data) => data.userId || (data.email && data.password && data.firstName && data.lastName), {
    message: 'Either userId must be provided OR (email, password, firstName, lastName) to create a new member'
  });
