export type OrderStatus = "PENDING" | "SUCCESS" | "EXPIRED" | "CANCELLED";

export interface OrderDetail {
  id: number;
  order_id: number;
  ticket_id: number;
  price: string;
  quantity: number;
  subtotal: string;
}

export interface Order {
  id: number;
  user_id: number;
  total_amount: string;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
  details: OrderDetail[];
}

export interface CreateOrderRequest {
  hold_ids: number[];
}

export interface ApiError {
  code?: string;
  message?: string;
}