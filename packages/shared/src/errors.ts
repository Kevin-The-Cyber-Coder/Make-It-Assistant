export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'VALIDATION_ERROR'
  | 'PROVIDER_UNAVAILABLE'
  | 'APPROVAL_REQUIRED'
  | 'EXECUTION_FAILED'
  | 'INTERNAL';

const STATUS: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  VALIDATION_ERROR: 422,
  PROVIDER_UNAVAILABLE: 503,
  APPROVAL_REQUIRED: 428,
  EXECUTION_FAILED: 500,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS[code];
    this.details = details;
  }
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: AppError };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const err = <T = never>(error: AppError): Result<T> => ({ ok: false, error });

export function toAppError(value: unknown): AppError {
  if (value instanceof AppError) return value;
  if (value instanceof Error) return new AppError('INTERNAL', value.message);
  return new AppError('INTERNAL', 'Unexpected non-error failure');
}

export function assert(condition: unknown, code: ErrorCode, message: string): asserts condition {
  if (!condition) throw new AppError(code, message);
}
