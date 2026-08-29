import type { Metadata } from "next";
import Link from "next/link";
import { Ticket } from "@phosphor-icons/react/dist/ssr";

export const metadata: Metadata = {
  title: "Events",
};

export default function HomePage() {
  return (
    <main className="min-h-[100dvh] bg-background text-foreground">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-medium tracking-tight"
          >
            <Ticket size={18} weight="duotone" className="text-accent" />
            Velaris
          </Link>
          <nav className="flex items-center gap-7 text-sm text-muted">
            <Link
              href="/public/events"
              className="transition-colors hover:text-foreground"
            >
              Events
            </Link>
            <Link
              href="/auth/login"
              className="transition-colors hover:text-foreground"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-16 px-6 py-20 md:grid-cols-[1.1fr_1fr] md:py-28">
        <div className="flex flex-col justify-center">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">
            Live availability · 15s sync
          </p>
          <h1 className="mt-6 text-5xl font-medium leading-[1.02] tracking-tighter md:text-7xl">
            Book seats
            <br />
            without the
            <br />
            <span className="text-accent">rush.</span>
          </h1>
          <p className="mt-8 max-w-[58ch] text-base leading-relaxed text-muted">
            Velaris holds your seat for ten minutes the moment you choose it.
            Confirm once, and the ticket is yours. No queues, no double-bookings,
            no surprise sold-outs.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link
              href="/public/events"
              className="inline-flex h-11 items-center justify-center rounded-md bg-accent px-5 text-sm font-medium text-accent-foreground transition-all hover:bg-accent-hover active:translate-y-px"
            >
              Browse events
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex h-11 items-center justify-center rounded-md border border-line bg-surface px-5 text-sm font-medium text-foreground transition-colors hover:bg-subtle"
            >
              I have an account
            </Link>
          </div>
        </div>

        <aside className="relative">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-line bg-surface p-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                Today
              </p>
              <p className="mt-4 text-3xl font-medium tracking-tighter">
                47.2%
              </p>
              <p className="mt-1 text-xs text-muted">
                of seats claimed by 9:14 AM
              </p>
            </div>
            <div className="rounded-lg border border-line bg-subtle p-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                Hold window
              </p>
              <p className="mt-4 text-3xl font-medium tracking-tighter">10:00</p>
              <p className="mt-1 text-xs text-muted">
                minutes, then auto-release
              </p>
            </div>
            <div className="col-span-2 rounded-lg border border-line bg-surface p-6">
              <div className="flex items-baseline justify-between">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                  Sample
                </p>
                <span className="font-mono text-xs text-accent">+1 (312) 847-1928</span>
              </div>
              <p className="mt-3 text-lg font-medium tracking-tight">
                Sigur Rós — Reykjavík Sessions
              </p>
              <p className="mt-1 text-xs text-muted">
                Harpa Concert Hall · Sat 19:30
              </p>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
