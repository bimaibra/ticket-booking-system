"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      console.error("Global error:", error);
    }
  }, [error]);

  return (
    <html>
      <body>
        <div className="flex min-h-[100dvh] items-center justify-center bg-background px-6 text-foreground">
          <div className="max-w-md rounded-lg border border-line bg-surface p-8 text-center">
            <h2 className="text-2xl font-medium tracking-tighter">
              Application error
            </h2>
            <p className="mt-3 text-sm text-muted">
              {error.message || "An unexpected error occurred."}
            </p>
            <button
              onClick={() => reset()}
              className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-accent px-5 text-sm font-medium text-accent-foreground transition-all hover:bg-accent-hover"
            >
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}