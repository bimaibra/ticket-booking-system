type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  url?: string;
  userId?: string;
  requestId?: string;
  stack?: string;
  componentStack?: string;
  extra?: Record<string, unknown>;
}

function isDev(): boolean {
  return process.env.NODE_ENV === "development";
}

function getUserId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const token = localStorage.getItem("velaris:access_token");
    if (!token) return undefined;
    const parts = token.split(".");
    if (parts.length < 2) return undefined;
    const payload = atob(parts[1]!.replace(/-/g, "+").replace(/_/g, "/"));
    const parsed = JSON.parse(payload);
    return parsed.sub || parsed.userId || undefined;
  } catch {
    return undefined;
  }
}

interface WindowWithRequestId extends Window {
  __REQUEST_ID__?: string;
}

function getRequestId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as WindowWithRequestId;
  return (
    w.__REQUEST_ID__ ||
    document
      .querySelector('meta[name="x-request-id"]')
      ?.getAttribute("content") ||
    undefined
  );
}

function log(level: LogLevel, message: string, error?: Error, extra?: Record<string, unknown>): void {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    url: typeof window !== "undefined" ? window.location.href : undefined,
    userId: getUserId(),
    requestId: getRequestId(),
    extra,
  };

  if (error) {
    entry.stack = error.stack;
    entry.message = error.message || message;
  }

  if (isDev()) {
    console[level](entry);
  }

  // In production, send to server endpoint
  if (!isDev() && typeof fetch !== "undefined") {
    fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    }).catch(() => {});
  }
}

export const logger = {
  debug: (msg: string, extra?: Record<string, unknown>) => log("debug", msg, undefined, extra),
  info: (msg: string, extra?: Record<string, unknown>) => log("info", msg, undefined, extra),
  warn: (msg: string, extra?: Record<string, unknown>) => log("warn", msg, undefined, extra),
  error: (msg: string, error?: Error, extra?: Record<string, unknown>) => log("error", msg, error, extra),
};