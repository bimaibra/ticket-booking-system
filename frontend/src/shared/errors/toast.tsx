"use client";

import { useEffect, useState } from "react";
import { mapError, type MappedError } from "./mapError";
import { cn } from "@/shared/lib/cn";
import { X, WarningCircle, Info, CheckCircle } from "@phosphor-icons/react";

type ToastKind = "info" | "success" | "error";
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

let counter = 0;
const listeners = new Set<(toast: Toast) => void>();

export function pushToast(message: string, kind: ToastKind = "info"): void {
  const id = ++counter;
  listeners.forEach((l) => l({ id, kind, message }));
}

export function pushErrorToast(err: unknown): void {
  const mapped: MappedError = mapError(err);
  pushToast(mapped.message, "error");
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const onPush = (t: Toast) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, 5000);
    };
    listeners.add(onPush);
    return () => {
      listeners.delete(onPush);
    };
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto flex items-start gap-3 rounded-md border border-line bg-surface px-4 py-3 shadow-xl min-w-[280px] max-w-md ring-1 ring-inset ring-foreground/5",
            t.kind === "error" && "border-danger/40",
            t.kind === "success" && "border-accent/40"
          )}
        >
          {t.kind === "error" ? (
            <WarningCircle size={18} className="text-danger mt-0.5" weight="fill" />
          ) : t.kind === "success" ? (
            <CheckCircle size={18} className="text-accent mt-0.5" weight="fill" />
          ) : (
            <Info size={18} className="text-muted mt-0.5" weight="fill" />
          )}
          <p className="flex-1 text-sm text-foreground">{t.message}</p>
          <button
            onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
            className="text-muted hover:text-foreground"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}