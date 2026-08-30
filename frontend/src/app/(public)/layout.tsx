import Link from "next/link";
import { Ticket } from "@phosphor-icons/react/dist/ssr";
import { ToastContainer } from "@/shared/errors/toast";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      <header className="border-b border-line sticky top-0 bg-background/80 backdrop-blur-md z-40">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
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
              href="/holds"
              className="transition-colors hover:text-foreground"
            >
              Holds
            </Link>
            <Link
              href="/orders"
              className="transition-colors hover:text-foreground"
            >
              Orders
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
      <main className="flex-1">{children}</main>
      <footer className="border-t border-line py-8 text-center text-xs text-muted">
        <div className="mx-auto max-w-7xl px-6 flex items-center justify-center">
          <p>© {new Date().getFullYear()} Velaris. Real-time ticket allocation.</p>
        </div>
      </footer>
      <ToastContainer />
    </div>
  );
}