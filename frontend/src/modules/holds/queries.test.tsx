import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useActiveHolds, useCreateHold, useCancelHold } from "./queries";
import { apiClient } from "@/shared/lib/api";

vi.mock("@/shared/lib/api", () => ({
  apiClient: vi.fn(),
}));

describe("holds queries", () => {
  let queryClient: QueryClient;

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it("useActiveHolds fetches holds", async () => {
    const mockHolds = [{ id: 1, ticket_id: 1, quantity: 2, expires_at: "2026-01-01" }];
    vi.mocked(apiClient).mockResolvedValueOnce(mockHolds as never);

    const { result } = renderHook(() => useActiveHolds(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(mockHolds);
    });
    expect(apiClient).toHaveBeenCalledWith("/holds");
  });

  it("useCreateHold posts hold", async () => {
    const mockHold = { id: 2, ticket_id: 1, quantity: 1 };
    vi.mocked(apiClient).mockResolvedValueOnce(mockHold as never);

    const { result } = renderHook(() => useCreateHold(), { wrapper });

    result.current.mutate({ ticket_id: 1, quantity: 1 });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(mockHold);
    });
    expect(apiClient).toHaveBeenCalledWith(
      "/holds",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ ticket_id: 1, quantity: 1 }) })
    );
  });

  it("useCancelHold deletes hold", async () => {
    vi.mocked(apiClient).mockResolvedValueOnce(undefined as never);

    const { result } = renderHook(() => useCancelHold(), { wrapper });

    result.current.mutate(42);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(apiClient).toHaveBeenCalledWith("/holds/42", expect.objectContaining({ method: "DELETE" }));
  });
});