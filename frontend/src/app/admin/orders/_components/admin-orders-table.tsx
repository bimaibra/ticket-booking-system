"use client";

import { useState } from "react";
import { useAdminOrders } from "@/modules/admin/queries";
import type { Order } from "@/modules/orders/types";
import { cn } from "@/shared/lib/cn";

export function AdminOrdersTable({ initialOrders }: { initialOrders: Order[] }) {
  const { data: orders = initialOrders } = useAdminOrders();
  const [filter, setFilter] = useState<string>("ALL");

  const filtered = orders.filter((o) => filter === "ALL" || o.status === filter);

  if (orders.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-surface p-8 text-center text-muted">
        No orders on the platform yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {["ALL", "SUCCESS", "PENDING", "EXPIRED", "CANCELLED"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-mono",
              filter === s
                ? "bg-accent text-accent-foreground"
                : "border border-line bg-surface text-muted hover:text-foreground"
            )}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-line bg-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-subtle text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3">Order #</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.map((o) => (
              <tr key={o.id} className="hover:bg-subtle/50">
                <td className="px-4 py-3 font-mono">#{o.id}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted">
                  User #{o.user_id}
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  ${parseFloat(o.total_amount).toFixed(2)}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-subtle px-2.5 py-0.5 text-[10px] font-mono">
                    {o.status}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted">
                  {new Date(o.created_at).toLocaleDateString("en-US")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}