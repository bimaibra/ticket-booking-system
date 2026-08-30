import type { Metadata } from "next";
import Link from "next/link";
import { Ticket } from "@phosphor-icons/react/dist/ssr";
import { HeroSection } from "./_components/HeroSection";

export const metadata: Metadata = {
  title: "Velaris - Book seats without the rush",
  description:
    "Velaris holds your seat for ten minutes while you confirm. No queues, no double-bookings.",
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
              href="/events"
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

      <HeroSection />
    </main>
  );
}