import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";

export default function AdminHomePage() {
  const sections = [
    { href: "/admin/events", title: "Events", desc: "Create, edit, delete events." },
    { href: "/admin/orders", title: "Orders", desc: "View all confirmed bookings." },
    { href: "/admin/users", title: "Users", desc: "Manage roles and accounts." },
  ];

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <h1 className="text-4xl font-medium tracking-tighter">Admin Console</h1>
      <p className="mt-3 max-w-[60ch] text-muted">
        Manage platform data, bookings, and users.
      </p>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="group rounded-lg border border-line bg-surface p-6 transition-colors hover:border-foreground/30"
          >
            <h2 className="font-medium">{s.title}</h2>
            <p className="mt-2 text-sm text-muted">{s.desc}</p>
            <p className="mt-4 inline-flex items-center gap-1 text-xs text-accent">
              Open <ArrowRight size={12} />
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}