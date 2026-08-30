import { NewEventForm } from "./_components/new-event-form";

export default function NewEventPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-3xl font-medium tracking-tighter">New Event</h1>
      <p className="mt-2 text-sm text-muted">Create a new event.</p>
      <div className="mt-8">
        <NewEventForm />
      </div>
    </div>
  );
}