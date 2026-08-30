import { apiClient } from "@/shared/lib/api";
import type { Event } from "@/modules/events/types";
import { AdminEventsTable } from "./_components/admin-events-table";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function getEvents(): Promise<Event[]> {
  return apiClient<Event[]>("/events").catch(() => []);
}

export default async function AdminEventsPage() {
  const events = await getEvents();

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-medium tracking-tighter">Events</h1>
          <p className="mt-2 text-sm text-muted">{events.length} event(s) total</p>
        </div>
        <Link
          href="/admin/events/new"
          className="inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground transition-all hover:bg-accent-hover"
        >
          <Plus size={14} /> New Event
        </Link>
      </div>

      <AdminEventsTable initialEvents={events} />
    </div>
  );
}