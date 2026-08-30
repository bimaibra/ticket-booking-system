"use client";

import { useSyncExternalStore } from "react";
import { ShieldWarning } from "@phosphor-icons/react";
import Link from "next/link";

const TOKEN_KEY = "velaris:access_token";
const ROLE_KEY = "velaris:user_role";

type Status = "loading" | "ok" | "forbidden";

interface DecodedToken {
  role?: string;
  exp?: number;
  [key: string]: unknown;
}

function decodeToken(token: string): DecodedToken | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = atob(parts[1]!.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(payload) as DecodedToken;
  } catch {
    return null;
  }
}

function checkStatus(): Status {
  if (typeof window === "undefined") return "loading";

  const token = window.localStorage.getItem(TOKEN_KEY);
  const cachedRole = window.localStorage.getItem(ROLE_KEY);

  if (!token) return "forbidden";
  if (cachedRole === "ADMIN") return "ok";

  const decoded = decodeToken(token);
  if (decoded?.exp && decoded.exp * 1000 < Date.now()) return "forbidden";
  if (decoded?.role === "ADMIN") {
    window.localStorage.setItem(ROLE_KEY, decoded.role);
    return "ok";
  }
  return "forbidden";
}

function subscribe(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  window.addEventListener("velaris:auth", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("velaris:auth", callback);
  };
}

export function RoleGuard({ children }: { children: React.ReactNode }) {
  const status = useSyncExternalStore(subscribe, checkStatus, () => "loading");

  if (status === "loading") {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <div className="h-8 w-8 rounded-full bg-subtle animate-pulse" />
      </div>
    );
  }

  if (status === "forbidden") {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center px-6">
        <div className="max-w-md rounded-lg border border-line bg-surface p-8 text-center">
          <ShieldWarning
            size={32}
            weight="duotone"
            className="mx-auto text-warning"
          />
          <h1 className="mt-4 text-2xl font-medium tracking-tight">
            Admin access required
          </h1>
          <p className="mt-3 text-sm text-muted">
            This area is restricted to administrators. Sign in with an admin
            account to continue.
          </p>
          <Link
            href="/auth/login"
            className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-accent px-5 text-sm font-medium text-accent-foreground transition-all hover:bg-accent-hover"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}