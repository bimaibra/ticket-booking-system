"use client";

import { useOrderHistory } from "@/modules/orders/queries";
import type { Order } from "@/modules/orders/types";
import { OrderCard } from "./order-card";

export function OrderList({ initialOrders }: { initialOrders: Order[] }) {
  const { data: orders = initialOrders, isLoading } = useOrderHistory();

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 rounded-lg border border-line bg-surface animate-pulse" />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-surface p-12 text-center text-muted">
        No orders yet. Browse events to book tickets.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </div>
  );
}