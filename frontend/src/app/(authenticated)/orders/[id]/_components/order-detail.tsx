"use client";

import { useOrder } from "@/modules/orders/queries";
import type { Order } from "@/modules/orders/types";
import { cn } from "@/shared/lib/cn";

interface OrderDetailProps {
  order: Order;
}

export function OrderDetail({ order: initialOrder }: OrderDetailProps) {
  const { data: order = initialOrder } = useOrder(initialOrder.id);

  const statusColor =
    order.status === "SUCCESS"
      ? "bg-emerald-500/10 text-accent"
      : order.status === "EXPIRED"
        ? "bg-subtle text-muted"
        : "bg-warning/10 text-warning";

  return (
    <div className="space-y-8">
      <section>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
          Order #{order.id}
        </p>
        <h1 className="mt-4 text-4xl font-medium tracking-tighter">
          ${parseFloat(order.total_amount).toFixed(2)} USD
        </h1>
        <div className="mt-4 flex items-center gap-3 text-sm text-muted">
          <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-mono", statusColor)}>
            {order.status}
          </span>
          <span className="font-mono text-xs">
            {new Date(order.created_at).toLocaleString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      </section>

      {order.details.length > 0 && (
        <section>
          <h2 className="text-xl font-medium tracking-tight">Items</h2>
          <div className="mt-4 space-y-3">
            {order.details.map((detail) => (
              <div
                key={detail.id}
                className="flex items-center justify-between rounded-lg border border-line bg-surface p-4"
              >
                <div>
                  <p className="text-sm font-medium">Ticket #{detail.ticket_id}</p>
                  <p className="font-mono text-xs text-muted">
                    ×{detail.quantity} @ ${parseFloat(detail.price).toFixed(2)}
                  </p>
                </div>
                <p className="font-mono text-sm">
                  ${parseFloat(detail.subtotal).toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}