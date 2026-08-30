import { describe, it, expect, beforeEach, vi } from "vitest";
import { isUuidV4, generateUuidV4, getCachedKey, setCachedKey, clearCachedKey } from "./idempotency";

describe("isUuidV4", () => {
  it("accepts valid UUID v4", () => {
    expect(isUuidV4("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(isUuidV4("f47ac10b-58cc-4372-a567-0e02b2c3d479")).toBe(true);
  });

  it("rejects non-UUID v4", () => {
    expect(isUuidV4("not-a-uuid")).toBe(false);
    expect(isUuidV4("550e8400-e29b-11d4-a716-446655440000")).toBe(false);
    expect(isUuidV4("550e8400-e29b-41d4-a716-44665544000")).toBe(false);
  });
});

describe("generateUuidV4", () => {
  it("generates UUID v4", () => {
    const key = generateUuidV4();
    expect(isUuidV4(key)).toBe(true);
  });

  it("generates unique keys", () => {
    const a = generateUuidV4();
    const b = generateUuidV4();
    expect(a).not.toBe(b);
  });
});

describe("sessionStorage caching", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, v),
        removeItem: (k: string) => store.delete(k),
      },
    });
  });

  it("round-trips key by intent hash", () => {
    setCachedKey([3, 1, 2], "550e8400-e29b-41d4-a716-446655440000");
    expect(getCachedKey([1, 2, 3])).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("returns null when not set", () => {
    expect(getCachedKey([1, 2])).toBeNull();
  });

  it("ignores non-UUID values on set", () => {
    setCachedKey([1, 2], "not-uuid");
    expect(getCachedKey([1, 2])).toBeNull();
  });

  it("clears cached key", () => {
    setCachedKey([1, 2], "550e8400-e29b-41d4-a716-446655440000");
    clearCachedKey([1, 2]);
    expect(getCachedKey([1, 2])).toBeNull();
  });
});