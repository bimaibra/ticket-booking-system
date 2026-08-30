const STORAGE_PREFIX = "velaris:idem:";

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuidV4(value: string): boolean {
  return UUID_V4_RE.test(value);
}

export function generateUuidV4(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback: build a UUIDv4-shaped string from Math.random (browser-only).
  const r = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, "0");
  return `${r()}${r()}-${r()}-4${r().slice(1)}-${(8 + Math.floor(Math.random() * 4)).toString(16)}${r().slice(1)}-${r()}${r()}${r()}`;
}

function intentKey(holdIds: number[]): string {
  return [...holdIds].sort((a, b) => a - b).join(",");
}

export function getCachedKey(holdIds: number[]): string | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(STORAGE_PREFIX + intentKey(holdIds));
  if (!raw) return null;
  if (!isUuidV4(raw)) return null;
  return raw;
}

export function setCachedKey(holdIds: number[], key: string): void {
  if (typeof window === "undefined") return;
  if (!isUuidV4(key)) return;
  window.sessionStorage.setItem(STORAGE_PREFIX + intentKey(holdIds), key);
}

export function clearCachedKey(holdIds: number[]): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(STORAGE_PREFIX + intentKey(holdIds));
}