const counters = new Map<string, number>();
const histograms = new Map<string, number[]>();

export function resetMetrics(): void {
  counters.clear();
  histograms.clear();
}

export function incrementCounter(name: string, tags: Record<string, string | number> = {}, value = 1): void {
  const key = [name, ...Object.entries(tags).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => `${k}="${v}"`)]
    .join('{');
  counters.set(key, (counters.get(key) ?? 0) + value);
}

export function observeHistogram(name: string, value: number): void {
  const current = histograms.get(name) ?? [];
  current.push(value);
  histograms.set(name, current);
}

export function getMetricsSnapshot(): string {
  const lines: string[] = [];
  for (const [key, value] of counters) {
    const [name] = key.split('{');
    lines.push(`# TYPE ${name} counter`);
    lines.push(`${key} ${value}`);
  }
  for (const [name, values] of histograms) {
    if (values.length === 0) continue;
    const sorted = [...values].sort((a, b) => a - b);
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
    lines.push(`# TYPE ${name} histogram`);
    lines.push(`${name}_p95_ms ${p95}`);
    lines.push(`${name}_count ${values.length}`);
  }
  return lines.join('\n');
}

export interface BookingOutcomeTags {
  outcome: string;
}

export function meterHoldOutcome(outcome: string): void {
  incrementCounter('hold_outcomes_total', { outcome });
}

export function meterBookingOutcome(outcome: string): void {
  incrementCounter('booking_outcomes_total', { outcome });
  observeHistogram('booking_duration_ms', 0);
}

export function meterIdempotencyOutcome(outcome: string): void {
  incrementCounter('idempotency_outcomes_total', { outcome });
}