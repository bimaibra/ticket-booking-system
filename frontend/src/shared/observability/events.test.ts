import { describe, it, expect, vi, beforeEach } from "vitest";
import { trackEvent, trackHoldCreated, trackOrderSucceeded } from "./events";

describe("trackEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(),
    });
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("console", { log: vi.fn() });
  });

  it("logs to console in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    trackEvent("hold_created", { holdId: 1 });
    expect(console.log).toHaveBeenCalledWith("[track]", expect.objectContaining({
      name: "hold_created",
      properties: { holdId: 1 },
    }));
  });

  it("sends POST to /api/events in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const fetchMock = vi.mocked(fetch).mockResolvedValue({} as Response);
    trackEvent("order_succeeded", { orderId: 5 });
    expect(fetchMock).toHaveBeenCalledWith("/api/events", expect.objectContaining({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: expect.stringContaining("order_succeeded"),
    }));
  });

  it("swallows fetch errors", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.mocked(fetch).mockRejectedValue(new Error("Network"));
    expect(() => trackEvent("auth_login", {})).not.toThrow();
  });

  it("includes userId from token", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.mocked(localStorage.getItem).mockReturnValue("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMiLCJ1c2VySWQiOjQ1Nn0.xyz");
    trackEvent("auth_logout", {});
    expect(console.log).toHaveBeenCalledWith("[track]", expect.objectContaining({
      userId: "123",
    }));
  });

  it("trackHoldCreated wrapper", () => {
    vi.stubEnv("NODE_ENV", "development");
    trackHoldCreated(7, 8, 3);
    expect(console.log).toHaveBeenCalledWith("[track]", expect.objectContaining({
      name: "hold_created",
      properties: { holdId: 7, ticketId: 8, quantity: 3 },
    }));
  });

  it("trackOrderSucceeded wrapper", () => {
    vi.stubEnv("NODE_ENV", "development");
    trackOrderSucceeded(10, [1, 2]);
    expect(console.log).toHaveBeenCalledWith("[track]", expect.objectContaining({
      name: "order_succeeded",
      properties: { orderId: 10, holdIds: [1, 2] },
    }));
  });
});