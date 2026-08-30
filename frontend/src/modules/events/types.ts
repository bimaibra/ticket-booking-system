export interface Event {
  id: number;
  name: string;
  event_date: string;
  description?: string;
  address?: string;
  created_at: string;
  updated_at: string;
}

export interface Ticket {
  id: number;
  event_id: number;
  name: string;
  available_quota: number;
  total_quota: number;
  price: string;
  last_updated: string;
  created_at: string;
  updated_at: string;
}

export interface TicketAvailability {
  ticket_id: number;
  name: string;
  price: string;
  total_quota: number;
  available_quota: number;
  last_updated: string;
}

export interface AvailabilityResponse {
  event_id: number;
  tickets: TicketAvailability[];
}