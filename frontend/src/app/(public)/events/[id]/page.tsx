import { apiClient } from "@/shared/lib/api";
import type { Event } from "@/modules/events/types";
import { notFound } from "next/navigation";
import { TicketList } from "./_components/ticket-list";
import { MapPin, CalendarBlank } from "@phosphor-icons/react/dist/ssr";
import Image from "next/image";
import type { Metadata } from "next";

export const revalidate = 60;

async function getEvent(id: number): Promise<Event | null> {
  return apiClient<Event>(`/events/${id}`).catch(() => null);
}

export async function generateStaticParams() {
  const events = await apiClient<Event[]>("/events").catch(() => []);
  return events.slice(0, 5).map((e) => ({ id: String(e.id) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const event = await getEvent(Number(id));
  if (!event) return { title: "Event Not Found" };

  return {
    title: event.name,
    description: event.description ?? `Event at ${event.address}`,
    openGraph: {
      title: event.name,
      description: event.description ?? undefined,
      type: "article",
      images: `/og/events/${event.id}`,
    },
  };
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getEvent(Number(id));
  if (!event) notFound();

  const seed = `event-detail-${event.id}-${event.name}`;

  return (
    <div className="mx-auto max-w-4xl px-6 py-12 md:py-16">
      <section className="mb-12">
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-subtle">
          <Image
            src={`https://picsum.photos/seed/${encodeURIComponent(seed)}/1200/675`}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 896px"
            className="object-cover"
            priority
          />
        </div>
        <h1 className="mt-8 text-4xl font-medium tracking-tighter md:text-5xl">
          {event.name}
        </h1>
        <div className="mt-6 flex flex-col gap-3 text-sm text-muted">
          <div className="flex items-center gap-2">
            <CalendarBlank size={14} weight="duotone" />
            <span>
              {new Date(event.event_date).toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          {event.address && (
            <div className="flex items-center gap-2">
              <MapPin size={14} weight="duotone" />
              <span>{event.address}</span>
            </div>
          )}
        </div>
        {event.description && (
          <p className="mt-6 max-w-[65ch] text-base leading-relaxed text-muted">
            {event.description}
          </p>
        )}
      </section>

      <section>
        <h2 className="text-2xl font-medium tracking-tight">Tickets</h2>
        <p className="mt-2 text-sm text-muted">
          Live availability. Seats update every 15 seconds.
        </p>
        <div className="mt-6">
          <TicketList eventId={event.id} />
        </div>
      </section>
    </div>
  );
}