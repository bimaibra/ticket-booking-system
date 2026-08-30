"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCreateEvent } from "@/modules/admin/queries";
import { pushToast, pushErrorToast } from "@/shared/errors/toast";

export function NewEventForm() {
  const router = useRouter();
  const createEvent = useCreateEvent();
  const [form, setForm] = useState({
    name: "",
    event_date: "",
    address: "",
    description: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createEvent.mutateAsync({
        ...form,
        event_date: new Date(form.event_date).toISOString(),
      });
      pushToast("Event created successfully.", "success");
      router.push("/admin/events");
    } catch {
      pushErrorToast("Failed to create event.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <label className="text-sm font-medium">Name</label>
        <input
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Date & Time</label>
        <input
          required
          type="datetime-local"
          value={form.event_date}
          onChange={(e) => setForm({ ...form, event_date: e.target.value })}
          className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm font-mono"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Address</label>
        <input
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Description</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={4}
          className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={createEvent.isPending}
        className="w-full inline-flex h-11 items-center justify-center rounded-md bg-accent text-sm font-medium text-accent-foreground transition-all hover:bg-accent-hover disabled:opacity-50"
      >
        {createEvent.isPending ? "Creating..." : "Create Event"}
      </button>
    </form>
  );
}