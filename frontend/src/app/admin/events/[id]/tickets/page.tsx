import { apiClient } from "@/shared/lib/api";
import type { Ticket } from "@/modules/events/types";
import { AdminTicketsTable } from "./_components/admin-tickets-table";

export const dynamic = "force-dynamic";

async function getTickets(eventId: number): Promise<Ticket[]> {
  return apiClient<Ticket[]>(`/events/${eventId}/tickets`).catch(() => []);
}

export default async function AdminEventTicketsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const eventId = Number(id);
  const tickets = await getTickets(eventId);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-medium tracking-tighter">
          Event #{eventId} Tickets
        </h1>
      </div>
      <AdminTicketsTable eventId={eventId} initialTickets={tickets} />
    </div>
  );
}