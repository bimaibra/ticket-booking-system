import { RoleGuard } from "@/modules/admin/role-guard";
import Link from "next/link";
import { ClipboardText, Users, Wrench } from "@phosphor-icons/react/dist/ssr";
import { ToastContainer } from "@/shared/errors/toast";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoleGuard>
      <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
        <header className="border-b border-line">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Link href="/admin" className="flex items-center gap-2 text-sm font-medium">
                <Wrench size={18} weight="duotone" className="text-accent" />
                Velaris Admin
              </Link>
              <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-mono text-warning">
                ADMIN
              </span>
            </div>
            <nav className="flex flex-wrap items-center gap-5 text-sm text-muted">
              <Link href="/admin/events" className="flex items-center gap-1.5 transition-colors hover:text-foreground">
                <ClipboardText size={14} /> Events
              </Link>
              <Link href="/admin/orders" className="flex items-center gap-1.5 transition-colors hover:text-foreground">
                <ClipboardText size={14} /> Orders
              </Link>
              <Link href="/admin/users" className="flex items-center gap-1.5 transition-colors hover:text-foreground">
                <Users size={14} /> Users
              </Link>
              <Link href="/" className="transition-colors hover:text-foreground">
                Exit
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <ToastContainer />
      </div>
    </RoleGuard>
  );
}