"use client";

import { useAdminEvents, useDeleteEvent } from "@/modules/admin/queries";
import type { Event } from "@/modules/events/types";
import { useState } from "react";
import { cn } from "@/shared/lib/cn";
import { Trash, Eye } from "@phosphor-icons/react";
import Link from "next/link";
import { pushToast, pushErrorToast } from "@/shared/errors/toast";

export function AdminEventsTable({ initialEvents }: { initialEvents: Event[] }) {
  const { data: events = initialEvents } = useAdminEvents();
  const deleteEvent = useDeleteEvent();

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this event?")) return;
    try {
      await deleteEvent.mutateAsync(id);
      pushToast("Event deleted successfully.", "success");
    } catch (err) {
      const e = err as Error & { status?: number };
      if (e.status === 409) {
        pushErrorToast("Cannot delete event with existing history.");
      } else {
        pushErrorToast("Failed to delete event.");
      }
    }
  };

  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-surface p-8 text-center text-muted">
        No events yet. Create your first one.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-line bg-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-subtle text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Address</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {events.map((e) => (
              <tr key={e.id} className="hover:bg-subtle/50">
                <td className="px-4 py-3 font-medium">{e.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted">
                  {new Date(e.event_date).toLocaleDateString("en-US")}
                </td>
                <td className="px-4 py-3 text-muted">{e.address || "-"}</td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex gap-2">
                    <Link
                      href={`/admin/events/${e.id}/tickets`}
                      className={cn(
                        "inline-flex h-8 w-8 items-center justify-center rounded-md border border-line text-muted hover:text-foreground hover:bg-subtle"
                      )}
                      title="Manage tickets"
                    >
                      <Eye size={14} />
                    </Link>
                    <button
                      onClick={() => handleDelete(e.id)}
                      disabled={deleteEvent.isPending}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line text-muted hover:text-danger hover:border-danger/50 disabled:opacity-50"
                      title="Delete event"
                    >
                      <Trash size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}