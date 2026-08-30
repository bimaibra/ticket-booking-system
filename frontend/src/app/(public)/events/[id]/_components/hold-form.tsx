"use client";

import { useState } from "react";
import { useCreateHold } from "@/modules/holds/queries";
import { pushToast, pushErrorToast } from "@/shared/errors/toast";

interface HoldFormProps {
  eventId: number;
  ticketId: number;
  ticketName: string;
  availableQuota: number;
}

export function HoldForm({ ticketId, availableQuota }: HoldFormProps) {
  const [quantity, setQuantity] = useState(1);
  const createHold = useCreateHold();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createHold.mutate({ ticket_id: ticketId, quantity }, {
      onSuccess: () => pushToast("Hold placed! 10 minutes remaining.", "success"),
      onError: (err) => pushErrorToast(err),
    });
  };

  if (availableQuota <= 0) return null;

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <label htmlFor={`qty-${ticketId}`} className="text-xs text-muted font-mono">
          QTY
        </label>
        <input
          id={`qty-${ticketId}`}
          type="number"
          min={1}
          max={availableQuota}
          value={quantity}
          onChange={(e) => setQuantity(Math.min(Number(e.target.value), availableQuota))}
          className="w-14 rounded border border-line bg-surface px-2 py-1 text-sm text-foreground"
        />
      </div>
      <button
        type="submit"
        disabled={createHold.isPending}
        className="inline-flex h-9 items-center justify-center rounded-md bg-accent px-4 text-xs font-medium text-accent-foreground transition-all hover:bg-accent-hover disabled:opacity-50"
      >
        {createHold.isPending ? "Holding..." : "Hold seat"}
      </button>

    </form>
  );
}