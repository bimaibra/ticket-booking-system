"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useActiveHolds } from "@/modules/holds/queries";
import { useCreateOrder } from "@/modules/orders/queries";
import { useState } from "react";
import { cn } from "@/shared/lib/cn";
import { pushToast, pushErrorToast } from "@/shared/errors/toast";

export function CheckoutForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const holdIdParam = searchParams.get("hold_ids");
  const initialIds = holdIdParam
    ? holdIdParam.split(",").map((x) => Number(x)).filter(Boolean)
    : [];

  const { data: holds = [], isLoading } = useActiveHolds();
  const [selectedIds, setSelectedIds] = useState<number[]>(initialIds);

  const createOrder = useCreateOrder();

  const activeHolds = holds.filter((h) => h.status === "ACTIVE");

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleCheckout = async () => {
    if (selectedIds.length === 0) {
      pushErrorToast("Please select at least one active hold.");
      return;
    }

    const res = await createOrder.mutateAsync({ hold_ids: selectedIds });

    if (res.order) {
      pushToast("Order confirmed. Your tickets are reserved.", "success");
      router.push(`/orders/${res.order.id}`);
      return;
    }

    switch (res.errorCode) {
      case "HOLD_EXPIRED":
        pushErrorToast("One or more holds have expired. Please reserve again.");
        setTimeout(() => router.push("/events"), 2500);
        break;
      case "IDEMPOTENCY_KEY_CONFLICT":
        pushErrorToast("Idempotency conflict. Key regenerated, please try again.");
        break;
      case "NETWORK":
        pushErrorToast("Network error. Please try again (your key is cached).");
        break;
      default:
        pushErrorToast("Failed to complete booking. Please try again.");
        break;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-12 w-full rounded bg-subtle" />
        <div className="h-12 w-full rounded bg-subtle" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {activeHolds.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface p-8 text-center text-muted">
          No active holds found to checkout.
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">
            Select holds to include in order:
          </p>
          {activeHolds.map((hold) => (
            <label
              key={hold.id}
              className={cn(
                "flex items-center justify-between rounded-lg border border-line bg-surface p-4 cursor-pointer hover:border-foreground/30",
                selectedIds.includes(hold.id) && "border-accent bg-emerald-500/5"
              )}
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(hold.id)}
                  onChange={() => toggleSelect(hold.id)}
                  className="accent-accent"
                />
                <div>
                  <p className="text-sm font-medium">Hold #{hold.id}</p>
                  <p className="text-xs text-muted font-mono">
                    Ticket #{hold.ticket_id} × {hold.quantity}
                  </p>
                </div>
              </div>
              <span className="font-mono text-xs text-muted">
                Expires {new Date(hold.expires_at).toLocaleTimeString()}
              </span>
            </label>
          ))}
        </div>
      )}

      <button
        onClick={handleCheckout}
        disabled={createOrder.isPending || selectedIds.length === 0}
        className="w-full inline-flex h-11 items-center justify-center rounded-md bg-accent text-sm font-medium text-accent-foreground transition-all hover:bg-accent-hover disabled:opacity-50"
      >
        {createOrder.isPending ? "Confirming Order..." : "Confirm & Pay"}
      </button>
    </div>
  );
}