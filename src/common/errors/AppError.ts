export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details: Record<string, any>;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_SERVER_ERROR', details: Record<string, any> = {}) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', code = 'RESOURCE_NOT_FOUND', details = {}) {
    super(message, 404, code, details);
  }
}

export class TaskNotFoundError extends NotFoundError {
  constructor(details = {}) {
    super('Task not found', 'TASK_NOT_FOUND', details);
  }
}

export class ProjectNotFoundError extends NotFoundError {
  constructor(details = {}) {
    super('Project not found', 'PROJECT_NOT_FOUND', details);
  }
}

export class UserNotFoundError extends NotFoundError {
  constructor(details = {}) {
    super('User not found', 'USER_NOT_FOUND', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', code = 'UNAUTHORIZED', details = {}) {
    super(message, 401, code, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access forbidden: cross-tenant or insufficient permissions', code = 'FORBIDDEN', details = {}) {
    super(message, 403, code, details);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details = {}) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource already exists', code = 'CONFLICT', details = {}) {
    super(message, 409, code, details);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', code = 'BAD_REQUEST', details = {}) {
    super(message, 400, code, details);
  }
}
