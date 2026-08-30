"use client";

import { useState } from "react";
import {
  useAdminEventTickets,
  useCreateTicket,
  useDeleteTicket,
} from "@/modules/admin/queries";
import type { Ticket } from "@/modules/events/types";
import { Trash, Plus } from "@phosphor-icons/react";
import { cn } from "@/shared/lib/cn";
import { pushToast, pushErrorToast } from "@/shared/errors/toast";

export function AdminTicketsTable({
  eventId,
  initialTickets,
}: {
  eventId: number;
  initialTickets: Ticket[];
}) {
  const { data: tickets = initialTickets } = useAdminEventTickets(eventId);
  const createTicket = useCreateTicket(eventId);
  const deleteTicket = useDeleteTicket();
  const [form, setForm] = useState({ name: "", total_quota: 100, price: "0.00" });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createTicket.mutateAsync({
        name: form.name,
        total_quota: Number(form.total_quota),
        price: form.price,
      });
      setForm({ name: "", total_quota: 100, price: "0.00" });
      pushToast("Ticket created successfully.", "success");
    } catch {
      pushErrorToast("Failed to create ticket.");
    }
  };

  const handleDelete = async (ticketId: number) => {
    if (!confirm("Delete this ticket?")) return;
    try {
      await deleteTicket.mutateAsync({ eventId, ticketId });
      pushToast("Ticket deleted successfully.", "success");
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.status === 409) {
        pushErrorToast("Cannot delete ticket with existing history.");
      } else {
        pushErrorToast("Failed to delete ticket.");
      }
    }
  };

  return (
    <div className="space-y-8">
      <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 rounded-lg border border-line bg-surface p-5 sm:grid-cols-[1fr_120px_120px_auto]">
        <input
          required
          placeholder="Ticket name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="rounded-md border border-line bg-background px-3 py-2 text-sm"
        />
        <input
          required
          type="number"
          min={1}
          placeholder="Quota"
          value={form.total_quota}
          onChange={(e) => setForm({ ...form, total_quota: Number(e.target.value) })}
          className="rounded-md border border-line bg-background px-3 py-2 text-sm font-mono"
        />
        <input
          required
          placeholder="Price"
          value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })}
          className="rounded-md border border-line bg-background px-3 py-2 text-sm font-mono"
        />
        <button
          type="submit"
          disabled={createTicket.isPending}
          className={cn(
            "inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-accent px-4 text-xs font-medium text-accent-foreground",
            createTicket.isPending && "opacity-50"
          )}
        >
          <Plus size={14} /> Add
        </button>
      </form>

      {tickets.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface p-8 text-center text-muted">
          No tickets yet. Add the first one.
        </div>
      ) : (
        <div className="rounded-lg border border-line bg-surface overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-subtle text-left text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Quota</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {tickets.map((t) => (
                <tr key={t.id} className="hover:bg-subtle/50">
                  <td className="px-4 py-3 font-medium">{t.name}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    ${parseFloat(t.price).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {t.available_quota} / {t.total_quota}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(t.id)}
                      disabled={deleteTicket.isPending}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line text-muted hover:text-danger hover:border-danger/50 disabled:opacity-50"
                    >
                      <Trash size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}