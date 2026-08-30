export interface Hold {
  id: number;
  user_id: number;
  ticket_id: number;
  quantity: number;
  expires_at: string;
  status: "ACTIVE" | "CONSUMED" | "EXPIRED" | "CANCELLED";
  created_at: string;
  updated_at: string;
}

export interface CreateHoldRequest {
  ticket_id: number;
  quantity?: number;
}