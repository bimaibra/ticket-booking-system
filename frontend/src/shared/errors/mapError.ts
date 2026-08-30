import { ErrorCode, type ApiErrorPayload } from "./errorCodes";

export type ErrorAction = "inline" | "toast" | "redirect" | "silent-retry" | "none";

export interface MappedError {
  code: string;
  message: string;
  action: ErrorAction;
  field?: string;
  retryAfter?: number;
  availableQuota?: number;
  redirectTo?: string;
}

const FALLBACK: MappedError = {
  code: ErrorCode.UNKNOWN,
  message: "An unexpected error occurred.",
  action: "toast",
};

export function mapError(err: unknown): MappedError {
  if (typeof err === "string") {
    return { ...FALLBACK, message: err };
  }
  if (!err || typeof err !== "object") return FALLBACK;

  const e = err as ApiErrorPayload & { status?: number };
  const code = e.code || ErrorCode.UNKNOWN;
  const message = e.message || FALLBACK.message;

  switch (code) {
    case ErrorCode.INSUFFICIENT_QUOTA:
      return {
        code,
        message: e.available_quota
          ? `Only ${e.available_quota} seat(s) available.`
          : "Not enough seats available.",
        action: "inline",
        field: "quantity",
        availableQuota: e.available_quota,
      };
    case ErrorCode.HOLD_EXPIRED:
      return {
        code,
        message: "Your hold expired. Please reserve again.",
        action: "redirect",
        redirectTo: "/events",
      };
    case ErrorCode.IDEMPOTENCY_IN_PROGRESS:
      return { code, message: "Processing…", action: "silent-retry" };
    case ErrorCode.IDEMPOTENCY_KEY_CONFLICT:
      return {
        code,
        message: "Booking conflict. Generating a fresh key, please retry.",
        action: "toast",
      };
    case ErrorCode.DB_TRANSACTION_RETRY_EXHAUSTED:
      return {
        code,
        message: "Temporary server issue. Retrying with the same key.",
        action: "silent-retry",
      };
    case ErrorCode.HISTORY_RETAINED:
      return {
        code,
        message: "Cannot delete. This item has history records.",
        action: "inline",
      };
    case ErrorCode.RATE_LIMITED:
      return {
        code,
        message: e.retry_after
          ? `Too many requests. Try again in ${e.retry_after}s.`
          : "Too many requests. Please slow down.",
        action: "inline",
        field: "submit",
        retryAfter: e.retry_after,
      };
    case ErrorCode.UNAUTHORIZED:
      return {
        code,
        message: (e as any).userMessage || e.message || "Invalid credentials. Please try again.",
        action: "inline",
      };
    case ErrorCode.FORBIDDEN:
      return {
        code,
        message: "You are not authorized for this action.",
        action: "inline",
      };
    case ErrorCode.NETWORK:
      return { code, message: "Network unavailable. Please retry.", action: "toast" };
    case ErrorCode.SERVER:
      return { code, message: "Server error. Please retry shortly.", action: "toast" };
    default:
      if (e.status === 401)
        return {
          code: ErrorCode.UNAUTHORIZED,
          message: "Session expired. Please sign in again.",
          action: "redirect",
          redirectTo: "/auth/login",
        };
      if (e.status === 403)
        return { code: ErrorCode.FORBIDDEN, message: "Not authorized.", action: "inline" };
      if (typeof e.status === "number" && e.status >= 500)
        return { code: ErrorCode.SERVER, message: "Server error. Please retry.", action: "toast" };
      return { ...FALLBACK, code, message };
  }
}