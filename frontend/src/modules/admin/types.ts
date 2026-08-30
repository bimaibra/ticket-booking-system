import type { Event, Ticket } from "@/modules/events/types";
import type { Order } from "@/modules/orders/types";
import type { Hold } from "@/modules/holds/types";

export type Role = "USER" | "ADMIN";

export interface AdminUser {
  id: number;
  username: string;
  name: string;
  email: string;
  role: Role;
  created_at: string;
  updated_at: string;
}

export type { Event, Ticket, Order, Hold };
export type { Event as AdminEvent, Ticket as AdminTicket, Order as AdminOrder };