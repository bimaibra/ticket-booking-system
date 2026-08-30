import { describe, it, expect } from "vitest";
import { ErrorCode } from "./errorCodes";
import { mapError } from "./mapError";

describe("mapError", () => {
  it("maps INSUFFICIENT_QUOTA to inline error with available_quota", () => {
    const result = mapError({
      code: ErrorCode.INSUFFICIENT_QUOTA,
      message: "Not enough",
      available_quota: 5,
    });
    expect(result.action).toBe("inline");
    expect(result.message).toContain("5");
    expect(result.availableQuota).toBe(5);
  });

  it("maps INSUFFICIENT_QUOTA without available_quota", () => {
    const result = mapError({ code: ErrorCode.INSUFFICIENT_QUOTA });
    expect(result.action).toBe("inline");
    expect(result.message).toContain("Not enough");
  });

  it("maps HOLD_EXPIRED to redirect to /events", () => {
    const result = mapError({ code: ErrorCode.HOLD_EXPIRED });
    expect(result.action).toBe("redirect");
    expect(result.redirectTo).toBe("/events");
  });

  it("maps IDEMPOTENCY_IN_PROGRESS to silent-retry", () => {
    const result = mapError({ code: ErrorCode.IDEMPOTENCY_IN_PROGRESS });
    expect(result.action).toBe("silent-retry");
  });

  it("maps IDEMPOTENCY_KEY_CONFLICT to toast", () => {
    const result = mapError({ code: ErrorCode.IDEMPOTENCY_KEY_CONFLICT });
    expect(result.action).toBe("toast");
    expect(result.message).toContain("conflict");
  });

  it("maps DB_TRANSACTION_RETRY_EXHAUSTED to silent-retry", () => {
    const result = mapError({ code: ErrorCode.DB_TRANSACTION_RETRY_EXHAUSTED });
    expect(result.action).toBe("silent-retry");
  });

  it("maps HISTORY_RETAINED to inline", () => {
    const result = mapError({ code: ErrorCode.HISTORY_RETAINED });
    expect(result.action).toBe("inline");
    expect(result.message).toContain("history");
  });

  it("maps RATE_LIMITED to inline with retryAfter", () => {
    const result = mapError({
      code: ErrorCode.RATE_LIMITED,
      retry_after: 60,
    });
    expect(result.action).toBe("inline");
    expect(result.retryAfter).toBe(60);
  });

  it("maps 401 status to redirect", () => {
    const result = mapError({ status: 401, message: "Unauthorized" });
    expect(result.action).toBe("redirect");
    expect(result.redirectTo).toBe("/auth/login");
  });

  it("maps 403 status to inline", () => {
    const result = mapError({ status: 403, message: "Forbidden" });
    expect(result.action).toBe("inline");
  });

  it("maps 5xx status to toast", () => {
    const result = mapError({ status: 500, message: "Server error" });
    expect(result.action).toBe("toast");
  });

  it("falls back to toast for unknown", () => {
    const result = mapError({ code: "MADE_UP" });
    expect(result.action).toBe("toast");
  });

  it("handles string errors", () => {
    const result = mapError("oops");
    expect(result.message).toBe("oops");
    expect(result.action).toBe("toast");
  });

  it("handles null/undefined", () => {
    expect(mapError(null).action).toBe("toast");
    expect(mapError(undefined).action).toBe("toast");
  });
});