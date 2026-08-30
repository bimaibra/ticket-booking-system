import { Suspense } from "react";
import { CheckoutForm } from "./checkout-form";

export const dynamic = "force-dynamic";

export default function CheckoutPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <section className="mb-10">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
          Booking
        </p>
        <h1 className="mt-4 text-4xl font-medium tracking-tighter">
          Confirm Reservation
        </h1>
        <p className="mt-3 max-w-[60ch] text-muted">
          Booking creates an idempotent order. Re-tries reuse the same key to
          prevent double-bookings.
        </p>
      </section>

      <Suspense fallback={<div className="h-40 rounded bg-subtle animate-pulse" />}>
        <CheckoutForm />
      </Suspense>
    </div>
  );
}