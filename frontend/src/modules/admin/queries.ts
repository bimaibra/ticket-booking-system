import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/shared/lib/api";
import type {
  AdminUser,
  Event,
  Ticket,
  Order,
  Role,
} from "./types";

const BASE = "/admin";

export const adminKeys = {
  all: ["admin"] as const,
  events: () => [...adminKeys.all, "events"] as const,
  event: (id: number) => [...adminKeys.all, "events", id] as const,
  tickets: (eventId: number) => [...adminKeys.all, "tickets", eventId] as const,
  users: () => [...adminKeys.all, "users"] as const,
  orders: () => [...adminKeys.all, "orders"] as const,
};

export function useAdminEvents() {
  return useQuery({
    queryKey: adminKeys.events(),
    queryFn: () => apiClient<Event[]>(`${BASE}/events`),
  });
}

export function useAdminEventTickets(eventId: number) {
  return useQuery({
    queryKey: adminKeys.tickets(eventId),
    queryFn: () => apiClient<Ticket[]>(`/events/${eventId}/tickets`),
    enabled: !!eventId,
  });
}

export function useAdminUsers() {
  return useQuery({
    queryKey: adminKeys.users(),
    queryFn: () => apiClient<AdminUser[]>(`${BASE}/users`),
  });
}

export function useAdminOrders() {
  return useQuery({
    queryKey: adminKeys.orders(),
    queryFn: () => apiClient<Order[]>(`${BASE}/orders`),
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Event, "id" | "created_at" | "updated_at">) =>
      apiClient<Event>("/events", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.events() });
    },
  });
}

export function useUpdateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Event> }) =>
      apiClient<Event>(`/events/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.events() });
    },
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiClient<unknown>(`/events/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.events() });
    },
  });
}

export function useCreateTicket(eventId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Ticket, "id" | "event_id" | "available_quota" | "last_updated" | "created_at" | "updated_at">) =>
      apiClient<Ticket>(`/events/${eventId}/tickets`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.tickets(eventId) });
    },
  });
}

export function useDeleteTicket() {
  return useMutation({
    mutationFn: ({ eventId, ticketId }: { eventId: number; ticketId: number }) =>
      apiClient<unknown>(`/events/${eventId}/tickets/${ticketId}`, {
        method: "DELETE",
      }),
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: number; role: Role }) =>
      apiClient<AdminUser>(`${BASE}/users/${id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminKeys.users() });
    },
  });
}