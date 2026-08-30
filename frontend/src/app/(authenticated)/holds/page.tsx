import { apiClient } from "@/shared/lib/api";
import type { Hold } from "@/modules/holds/types";
import { HoldList } from "./_components/hold-list";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getHolds(): Promise<Hold[]> {
  return apiClient<Hold[]>("/holds").catch(() => []);
}

export default async function HoldsPage() {
  const holds = await getHolds();
  const activeHolds = holds.filter((h) => h.status === "ACTIVE");
  const checkoutQuery = activeHolds.map((h) => h.id).join(",");

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <section className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-4xl font-medium tracking-tighter">Active Holds</h1>
          <p className="mt-3 max-w-[60ch] text-muted">
            Seats reserved for you. Expire after 10 minutes.
          </p>
        </div>
        {activeHolds.length > 0 && (
          <Link
            href={`/checkout?hold_ids=${checkoutQuery}`}
            className="inline-flex h-10 items-center justify-center rounded-md bg-accent px-5 text-sm font-medium text-accent-foreground transition-all hover:bg-accent-hover active:translate-y-px"
          >
            Proceed to checkout
          </Link>
        )}
      </section>

      <HoldList initialHolds={holds} />
    </div>
  );
}