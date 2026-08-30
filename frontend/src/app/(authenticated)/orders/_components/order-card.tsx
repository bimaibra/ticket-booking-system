import Link from "next/link";
import type { Order } from "@/modules/orders/types";
import { cn } from "@/shared/lib/cn";

interface OrderCardProps {
  order: Order;
}

export function OrderCard({ order }: OrderCardProps) {
  const statusColor =
    order.status === "SUCCESS"
      ? "bg-emerald-500/10 text-accent"
      : order.status === "EXPIRED"
        ? "bg-subtle text-muted"
        : "bg-warning/10 text-warning";

  return (
    <Link
      href={`/orders/${order.id}`}
      className="flex flex-col gap-3 rounded-lg border border-line bg-surface p-5 transition-colors hover:border-foreground/30 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <p className="font-medium text-foreground">
          Order #{order.id}
        </p>
        <p className="text-sm text-muted">
          {new Date(order.created_at).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
          {" · "}
          <span className="font-mono">
            ${parseFloat(order.total_amount).toFixed(2)} USD
          </span>
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-mono", statusColor)}>
          {order.status}
        </span>
        <span className="text-xs text-muted">{order.details.length} item(s)</span>
      </div>
    </Link>
  );
}