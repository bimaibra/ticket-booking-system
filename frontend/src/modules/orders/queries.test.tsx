import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useOrderHistory, useOrder, useCreateOrder } from "./queries";
import { apiClient } from "@/shared/lib/api";
import * as idempotency from "./idempotency";

vi.mock("@/shared/lib/api", () => ({
  apiClient: vi.fn(),
}));
vi.mock("./idempotency", () => ({
  getCachedKey: vi.fn(),
  setCachedKey: vi.fn(),
  clearCachedKey: vi.fn(),
  generateUuidV4: vi.fn(),
  isUuidV4: vi.fn(),
}));

describe("orders queries", () => {
  let queryClient: QueryClient;

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("sessionStorage", {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
  });

  it("useOrderHistory fetches orders", async () => {
    const mockOrders = [{ id: 1, total: 100 }];
    vi.mocked(apiClient).mockResolvedValueOnce(mockOrders as never);

    const { result } = renderHook(() => useOrderHistory(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(mockOrders);
    });
    expect(apiClient).toHaveBeenCalledWith("/orders");
  });

  it("useOrder fetches single order", async () => {
    const mockOrder = { id: 42, total: 200 };
    vi.mocked(apiClient).mockResolvedValueOnce(mockOrder as never);

    const { result } = renderHook(() => useOrder(42), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(mockOrder);
    });
    expect(apiClient).toHaveBeenCalledWith("/orders/42");
  });

  it("useOrder skips fetch when id is 0", () => {
    const { result } = renderHook(() => useOrder(0), { wrapper });
    expect(result.current.isLoading).toBe(false);
    expect(apiClient).not.toHaveBeenCalled();
  });

  it("useCreateOrder posts order with idempotency key", async () => {
    vi.mocked(idempotency.getCachedKey).mockReturnValue(null);
    vi.mocked(idempotency.generateUuidV4).mockReturnValue("550e8400-e29b-41d4-a716-446655440000");
    vi.mocked(idempotency.isUuidV4).mockReturnValue(true);
    const fetchMock = vi.mocked(fetch).mockResolvedValue({
      status: 201,
      json: async () => ({ id: 1, total: 100 }),
    } as Response);

    const { result } = renderHook(() => useCreateOrder(), { wrapper });

    result.current.mutate({ hold_ids: [1, 2] });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/orders"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Idempotency-Key": "550e8400-e29b-41d4-a716-446655440000",
        }),
      })
    );
    expect(idempotency.setCachedKey).toHaveBeenCalledWith([1, 2], "550e8400-e29b-41d4-a716-446655440000");
    expect(idempotency.clearCachedKey).toHaveBeenCalledWith([1, 2]);
  });

  it("useCreateOrder returns HOLD_EXPIRED on 410", async () => {
    vi.mocked(idempotency.getCachedKey).mockReturnValue("key");
    const fetchMock = vi.mocked(fetch).mockResolvedValue({
      status: 410,
      text: async () => JSON.stringify({ code: "HOLD_EXPIRED" }),
    } as Response);

    const { result } = renderHook(() => useCreateOrder(), { wrapper });

    result.current.mutate({ hold_ids: [1] });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data?.errorCode).toBe("HOLD_EXPIRED");
    });
    expect(idempotency.clearCachedKey).toHaveBeenCalledWith([1]);
  });

  it("useCreateOrder retries on IDEMPOTENCY_IN_PROGRESS", async () => {
    vi.mocked(idempotency.getCachedKey).mockReturnValue("key");
    const fetchMock = vi
      .mocked(fetch)
      .mockResolvedValueOnce({
        status: 202,
        text: async () => JSON.stringify({ code: "IDEMPOTENCY_IN_PROGRESS" }),
      } as Response)
      .mockResolvedValueOnce({
        status: 201,
        json: async () => ({ id: 2 }),
      } as Response);

    const { result } = renderHook(() => useCreateOrder(), { wrapper });

    result.current.mutate({ hold_ids: [1] });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});