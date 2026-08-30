"use client";

import { useState, useEffect } from "react";
import type { Hold } from "@/modules/holds/types";
import { useCancelHold } from "@/modules/holds/queries";
import { cn } from "@/shared/lib/cn";

interface HoldCardProps {
  hold: Hold;
}

export function HoldCard({ hold }: HoldCardProps) {
  const [timeLeft, setTimeLeft] = useState<string>("");
  const cancelHold = useCancelHold();

  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now();
      const expiry = new Date(hold.expires_at).getTime();
      const diff = Math.max(0, expiry - now);

      if (diff === 0) {
        setTimeLeft("Expired");
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${minutes}:${seconds.toString().padStart(2, "0")}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [hold.expires_at]);

  const isExpired = timeLeft === "Expired" || hold.status !== "ACTIVE";

  return (
    <div className={cn(
      "flex flex-col gap-3 rounded-lg border border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between",
      isExpired && "opacity-50"
    )}>
      <div>
        <p className="font-medium text-foreground">
          Ticket #{hold.ticket_id} × {hold.quantity}
        </p>
        <p className="text-sm text-muted font-mono">
          {isExpired ? "Expired" : `${timeLeft} remaining`}
        </p>
      </div>
      <div className="flex gap-3">
        <span className={cn(
          "rounded-full px-2.5 py-0.5 text-[11px] font-mono",
          isExpired ? "bg-subtle text-muted" : "bg-emerald-500/10 text-accent"
        )}>
          {hold.status}
        </span>
        {!isExpired && (
          <button
            onClick={() => cancelHold.mutate(hold.id)}
            disabled={cancelHold.isPending}
            className="inline-flex h-8 items-center justify-center rounded-md border border-line bg-surface px-3 text-xs font-medium text-foreground hover:bg-subtle disabled:opacity-50"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}