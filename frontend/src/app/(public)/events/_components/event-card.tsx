"use client";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { MapPin, CalendarBlank, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import type { Event } from "@/modules/events/types";
import { cn } from "@/shared/lib/cn";

interface EventCardProps {
  event: Event;
  className?: string;
  index?: number;
}

export function EventCard({ event, className, index = 0 }: EventCardProps) {
  const reduce = useReducedMotion();
  const eventDate = new Date(event.event_date);
  const dateLabel = eventDate.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeLabel = eventDate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const seed = `event-${event.id}-${event.name}`;

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, delay: reduce ? 0 : index * 0.06, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link
        href={`/events/${event.id}`}
        className={cn(
          "group flex flex-col overflow-hidden rounded-lg border border-line bg-surface transition-colors hover:border-foreground/30",
          className
        )}
      >
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-subtle">
          <Image
            src={`https://picsum.photos/seed/${encodeURIComponent(seed)}/640/400`}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
        </div>
        <div className="flex flex-col gap-4 p-6">
          <h2 className="text-lg font-medium tracking-tight leading-snug">
            {event.name}
          </h2>
          <div className="mt-auto flex flex-col gap-2 text-sm text-muted">
            <div className="flex items-center gap-2">
              <CalendarBlank size={14} weight="duotone" />
              <span>
                {dateLabel} · {timeLabel}
              </span>
            </div>
            {event.address && (
              <div className="flex items-center gap-2">
                <MapPin size={14} weight="duotone" />
                <span className="truncate">{event.address}</span>
              </div>
            )}
          </div>
          <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-accent">
            View tickets
            <ArrowRight
              size={12}
              weight="bold"
              className="transition-transform group-hover:translate-x-0.5"
            />
          </p>
        </div>
      </Link>
    </motion.div>
  );
}