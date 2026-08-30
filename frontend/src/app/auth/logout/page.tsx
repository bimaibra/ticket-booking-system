"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { trackAuthLogout } from "@/shared/observability/events";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("velaris:access_token");
      window.localStorage.removeItem("velaris:user_role");
      trackAuthLogout();
    }
    router.push("/auth/login");
  }, [router]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background text-muted text-sm">
      Signing out…
    </div>
  );
}