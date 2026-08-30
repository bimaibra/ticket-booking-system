import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/shared/lib/api";
import type { Hold, CreateHoldRequest } from "./types";

export const holdKeys = {
  all: ["holds"] as const,
  list: () => [...holdKeys.all, "list"] as const,
};

export function useActiveHolds() {
  return useQuery({
    queryKey: holdKeys.list(),
    queryFn: () => apiClient<Hold[]>("/holds"),
  });
}

export function useCreateHold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateHoldRequest) =>
      apiClient<Hold>("/holds", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: holdKeys.list() });
    },
  });
}

export function useCancelHold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (holdId: number) =>
      apiClient<Hold>(`/holds/${holdId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: holdKeys.list() });
    },
  });
}