"use client";

import { useActiveHolds } from "@/modules/holds/queries";
import type { Hold } from "@/modules/holds/types";
import { HoldCard } from "./hold-card";

export function HoldList({ initialHolds }: { initialHolds: Hold[] }) {
  const { data: holds = initialHolds, isLoading } = useActiveHolds();

  if (isLoading) {
    return <div className="space-y-4">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="h-24 rounded-lg border border-line bg-surface animate-pulse" />
      ))}
    </div>;
  }

  if (holds.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-surface p-12 text-center text-muted">
        No active holds. Browse events to reserve seats.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {holds.map((hold) => (
        <HoldCard key={hold.id} hold={hold} />
      ))}
    </div>
  );
}