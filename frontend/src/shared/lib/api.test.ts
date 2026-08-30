import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiClient } from "./api";

describe("apiClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("localStorage", { getItem: vi.fn() });
  });

  it("builds URL from API_BASE_URL and path", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: "test" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await apiClient("/events");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/events"),
      expect.objectContaining({
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
      })
    );
  });

  it("includes Content-Type header", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    await apiClient("/orders", {
      method: "POST",
      body: JSON.stringify({ hold_ids: [1, 2] }),
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
      })
    );
  });

  it("throws API error on non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => JSON.stringify({ message: "Not found" }),
      })
    );

    await expect(apiClient("/events/999")).rejects.toThrow(/404/);
  });

  it("parses JSON on ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 1, name: "Event" }),
      })
    );

    const result = await apiClient<{ id: number; name: string }>("/events/1");
    expect(result).toEqual({ id: 1, name: "Event" });
  });

  it("handles plain-text error body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      })
    );

    await expect(apiClient("/x")).rejects.toThrow(/500/);
  });
});