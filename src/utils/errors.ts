export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

export class HistoryRetainedError extends AppError {
  constructor(message: string = 'Cannot delete resource with existing history') {
    super(message, 409, 'HISTORY_RETAINED');
  }
}

export class GoneError extends AppError {
  constructor(message: string = 'Resource is gone or expired') {
    super(message, 410, 'GONE');
  }
}

export class TransactionRetryExhaustedError extends AppError {
  constructor(message: string = 'Database transaction failed after maximum retries due to contention') {
    super(message, 503, 'DB_TRANSACTION_RETRY_EXHAUSTED');
  }
}
