import type { Metadata } from "next";
import { apiClient } from "@/shared/lib/api";
import type { Event } from "@/modules/events/types";
import { EventCard } from "./_components/event-card";
import { EventCardSkeleton } from "./_components/event-card-skeleton";

export const metadata: Metadata = {
  title: "Events",
  description: "Browse upcoming events and check live ticket availability.",
};

export const revalidate = 60;

async function getEvents(): Promise<Event[]> {
  return apiClient<Event[]>("/events");
}

export default async function EventsPage() {
  const events = await getEvents().catch(() => null);

  return (
    <div className="mx-auto max-w-7xl px-6 py-12 md:py-16">
      <section className="mb-10">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
          Live availability
        </p>
        <h1 className="mt-4 text-4xl font-medium tracking-tighter md:text-5xl">
          Events
        </h1>
        <p className="mt-3 max-w-[60ch] text-muted">
          Seats shown reflect active holds and confirmed bookings. Availability
          refreshes every 15 seconds.
        </p>
      </section>

      {events ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event, index) => (
            <EventCard key={event.id} event={event} index={index} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <EventCardSkeleton key={i} />
          ))}
        </div>
      )}
    </div>
  );
}