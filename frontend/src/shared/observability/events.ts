type EventName =
  | "hold_created"
  | "hold_cancelled"
  | "hold_expired"
  | "order_succeeded"
  | "order_failed"
  | "order_hold_expired"
  | "auth_login"
  | "auth_logout"
  | "auth_refresh_failed";

interface EventPayload {
  name: EventName;
  properties: Record<string, unknown>;
  timestamp: string;
  userId?: string;
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

export function trackEvent(name: EventName, properties: Record<string, unknown> = {}): void {
  const event: EventPayload = {
    name,
    properties,
    timestamp: new Date().toISOString(),
    userId: getUserId(),
  };

  if (isDev()) {
    console.log("[track]", event);
  }

  if (!isDev() && typeof fetch !== "undefined") {
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    }).catch(() => {});
  }
}

// Convenience wrappers
export const trackHoldCreated = (holdId: number, ticketId: number, quantity: number) =>
  trackEvent("hold_created", { holdId, ticketId, quantity });
export const trackHoldCancelled = (holdId: number) => trackEvent("hold_cancelled", { holdId });
export const trackHoldExpired = (holdId: number) => trackEvent("hold_expired", { holdId });
export const trackOrderSucceeded = (orderId: number, holdIds: number[]) =>
  trackEvent("order_succeeded", { orderId, holdIds });
export const trackOrderFailed = (errorCode: string) =>
  trackEvent("order_failed", { errorCode });
export const trackOrderHoldExpired = (holdIds: number[]) =>
  trackEvent("order_hold_expired", { holdIds });
export const trackAuthLogin = (userId?: number) => trackEvent("auth_login", { userId });
export const trackAuthLogout = () => trackEvent("auth_logout", {});
export const trackAuthRefreshFailed = () => trackEvent("auth_refresh_failed", {});