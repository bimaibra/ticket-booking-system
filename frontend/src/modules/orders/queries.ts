import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/shared/lib/api";
import { holdKeys } from "@/modules/holds/queries";
import {
  clearCachedKey,
  generateUuidV4,
  getCachedKey,
  isUuidV4,
  setCachedKey,
} from "./idempotency";
import type { CreateOrderRequest, Order } from "./types";

const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 250;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export const orderKeys = {
  all: ["orders"] as const,
  list: () => [...orderKeys.all, "list"] as const,
  detail: (id: number) => [...orderKeys.all, "detail", id] as const,
};

export function useOrderHistory() {
  return useQuery({
    queryKey: orderKeys.list(),
    queryFn: () => apiClient<Order[]>("/orders"),
    staleTime: Infinity,
  });
}

export function useOrder(id: number) {
  return useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: () => apiClient<Order>(`/orders/${id}`),
    staleTime: Infinity,
    enabled: !!id,
  });
}

export interface BookingOutcome {
  order?: Order;
  errorCode?:
    | "HOLD_EXPIRED"
    | "IDEMPOTENCY_KEY_CONFLICT"
    | "NETWORK"
    | "UNKNOWN"
    | "ABORTED";
}

async function postOrder(
  holdIds: number[],
  key: string
): Promise<{ order: Order; status: number }> {
  const body: CreateOrderRequest = { hold_ids: holdIds };
  const url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/orders`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": key,
    },
    body: JSON.stringify(body),
  });

  if (res.status === 201) {
    const order = (await res.json()) as Order;
    return { order, status: 201 };
  }

  const text = await res.text();
  let parsed: { code?: string; message?: string } = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { message: text };
  }
  const error = new Error(parsed.message || `HTTP ${res.status}`);
  (error as Error & { code?: string; status?: number }).code = parsed.code;
  (error as Error & { code?: string; status?: number }).status = res.status;
  throw error;
}

export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      input: CreateOrderRequest
    ): Promise<BookingOutcome> => {
      const holdIds = input.hold_ids;
      let key = getCachedKey(holdIds);
      if (!key) {
        key = generateUuidV4();
        if (!isUuidV4(key)) {
          return { errorCode: "UNKNOWN" };
        }
        setCachedKey(holdIds, key);
      }

      // 5xx or transient network -> retry with same key (exponential backoff).
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          const { order } = await postOrder(holdIds, key);
          clearCachedKey(holdIds);
          queryClient.invalidateQueries({ queryKey: holdKeys.list() });
          queryClient.invalidateQueries({ queryKey: orderKeys.list() });
          return { order };
        } catch (err) {
          const e = err as Error & { code?: string; status?: number };
          const code = e.code || "";
          const status = e.status || 0;

          if (status === 410 || code === "HOLD_EXPIRED") {
            clearCachedKey(holdIds);
            return { errorCode: "HOLD_EXPIRED" };
          }
          if (code === "IDEMPOTENCY_KEY_CONFLICT" || status === 409) {
            return { errorCode: "IDEMPOTENCY_KEY_CONFLICT" };
          }
          if (code === "IDEMPOTENCY_IN_PROGRESS" || status === 202) {
            await sleep(BACKOFF_BASE_MS * Math.pow(2, attempt));
            continue;
          }
          if (status >= 500 || status === 0) {
            if (attempt < MAX_RETRIES - 1) {
              await sleep(BACKOFF_BASE_MS * Math.pow(2, attempt));
              continue;
            }
            return { errorCode: "NETWORK" };
          }
          return { errorCode: "UNKNOWN" };
        }
      }

      return { errorCode: "ABORTED" };
    },
  });
}