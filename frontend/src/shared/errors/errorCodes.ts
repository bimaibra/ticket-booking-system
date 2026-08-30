export const ErrorCode = {
  // Quota / hold
  INSUFFICIENT_QUOTA: "INSUFFICIENT_QUOTA",
  HOLD_EXPIRED: "HOLD_EXPIRED",

  // Idempotency
  IDEMPOTENCY_IN_PROGRESS: "IDEMPOTENCY_IN_PROGRESS",
  IDEMPOTENCY_KEY_CONFLICT: "IDEMPOTENCY_KEY_CONFLICT",
  DB_TRANSACTION_RETRY_EXHAUSTED: "DB_TRANSACTION_RETRY_EXHAUSTED",

  // History
  HISTORY_RETAINED: "HISTORY_RETAINED",

  // Auth
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  RATE_LIMITED: "RATE_LIMITED",

  // Generic
  NETWORK: "NETWORK",
  SERVER: "SERVER",
  UNKNOWN: "UNKNOWN",
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ApiErrorPayload {
  message?: string;
  code?: string;
  field?: string;
  available_quota?: number;
  retry_after?: number;
}