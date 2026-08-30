import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEvents, useEventTickets } from "./queries";
import { apiClient } from "@/shared/lib/api";

vi.mock("@/shared/lib/api", () => ({
  apiClient: vi.fn(),
}));

describe("events queries", () => {
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

  it("useEvents fetches events", async () => {
    const mockEvents = [
      { id: 1, name: "Event 1", date: "2026-01-01" },
    ];
    vi.mocked(apiClient).mockResolvedValueOnce(mockEvents as never);

    const { result } = renderHook(() => useEvents(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(mockEvents);
    });
    expect(apiClient).toHaveBeenCalledWith("/events");
  });

  it("useEventTickets fetches tickets for event", async () => {
    const mockTickets = [{ id: 1, name: "VIP", price: 100, available_quota: 10 }];
    vi.mocked(apiClient).mockResolvedValueOnce(mockTickets as never);

    const { result } = renderHook(() => useEventTickets(42), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toEqual(mockTickets);
    });
    expect(apiClient).toHaveBeenCalledWith("/events/42/tickets");
  });

  it("useEventTickets skips fetch when eventId is 0", () => {
    const { result } = renderHook(() => useEventTickets(0), { wrapper });
    expect(result.current.isLoading).toBe(false);
    expect(apiClient).not.toHaveBeenCalled();
  });
});