import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/shared/lib/api";
import type { Event, Ticket, AvailabilityResponse } from "./types";

export const eventKeys = {
  all: ["events"] as const,
  list: () => [...eventKeys.all, "list"] as const,
  detail: (id: number) => [...eventKeys.all, "detail", id] as const,
  tickets: (eventId: number) => [...eventKeys.all, "tickets", eventId] as const,
  availability: (eventId: number) => [...eventKeys.all, "availability", eventId] as const,
};

export function useEvents() {
  return useQuery({
    queryKey: eventKeys.list(),
    queryFn: () => apiClient<Event[]>("/events"),
  });
}

export function useEventTickets(eventId: number) {
  return useQuery({
    queryKey: eventKeys.tickets(eventId),
    queryFn: () => apiClient<Ticket[]>(`/events/${eventId}/tickets`),
    enabled: !!eventId,
  });
}

export function useEventAvailability(eventId: number) {
  return useQuery({
    queryKey: eventKeys.availability(eventId),
    queryFn: () => apiClient<AvailabilityResponse>(`/events/${eventId}/availability`),
    refetchInterval: 15000,
    enabled: !!eventId,
  });
}