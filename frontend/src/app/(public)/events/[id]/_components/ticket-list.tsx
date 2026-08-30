"use client";

import { useEventAvailability } from "@/modules/events/queries";
import { SpinnerGap } from "@phosphor-icons/react";
import { cn } from "@/shared/lib/cn";
import { HoldForm } from "./hold-form";

interface TicketListProps {
  eventId: number;
}

export function TicketList({ eventId }: TicketListProps) {
  const { data, isLoading, isError, isFetching } =
    useEventAvailability(eventId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-lg border border-line bg-surface p-5 animate-pulse"
          >
            <div className="space-y-2">
              <div className="h-5 w-40 rounded bg-subtle" />
              <div className="h-3 w-24 rounded bg-subtle" />
            </div>
            <div className="h-9 w-28 rounded bg-subtle" />
          </div>
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-lg border border-line bg-surface p-6 text-center text-sm text-muted">
        Failed to load ticket availability. Please refresh.
      </div>
    );
  }

  const tickets = data.tickets || [];
  const firstTicket = tickets[0];
  const latestUpdated = firstTicket
    ? tickets.reduce((acc, t) => (t.last_updated > acc ? t.last_updated : acc), firstTicket.last_updated)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end text-xs text-muted">
        {latestUpdated && (
          <span>
            Data freshness:{" "}
            <time className="font-mono">
              {new Date(latestUpdated).toLocaleTimeString()}
            </time>
            {isFetching && (
              <SpinnerGap
                size={14}
                className="inline-block ml-2 animate-spin text-accent"
              />
            )}
          </span>
        )}
      </div>

      {tickets.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface p-6 text-center text-sm text-muted">
          No tickets configured for this event.
        </div>
      ) : (
        <div className="space-y-4">
          {tickets.map((ticket) => {
            const isSoldOut = ticket.available_quota <= 0;
            return (
              <div
                key={ticket.ticket_id}
                className={cn(
                  "flex flex-col gap-4 rounded-lg border border-line bg-surface p-5 transition-colors sm:flex-row sm:items-center sm:justify-between",
                  isSoldOut && "opacity-60"
                )}
              >
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="font-medium text-foreground">{ticket.name}</h3>
                    {isSoldOut ? (
                      <span className="rounded-full bg-subtle px-2.5 py-0.5 text-[11px] font-mono text-muted">
                        SOLD OUT
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-mono text-accent">
                        {ticket.available_quota} / {ticket.total_quota} AVAILABLE
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm font-mono text-muted">
                    ${parseFloat(ticket.price).toFixed(2)} USD
                  </p>
                </div>

                <div>
                  {isSoldOut ? (
                    <button
                      disabled
                      className="inline-flex h-10 w-full items-center justify-center rounded-md bg-subtle px-4 text-xs font-medium text-muted cursor-not-allowed sm:w-auto"
                    >
                      Unavailable
                    </button>
                  ) : (
                    <HoldForm
                      eventId={eventId}
                      ticketId={ticket.ticket_id}
                      ticketName={ticket.name}
                      availableQuota={ticket.available_quota}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}