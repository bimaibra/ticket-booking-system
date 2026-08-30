import { onCLS, onINP, onLCP, onFCP, onTTFB } from "web-vitals";

type Metric = {
  name: string;
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  delta: number;
  id: string;
  navigationType: string;
};

function sendToAnalytics(metric: Metric): void {
  const body = {
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType,
    timestamp: new Date().toISOString(),
    url: window.location.href,
  };

  if (process.env.NODE_ENV === "development") {
    console.log("[web-vitals]", body);
    return;
  }

  if (typeof fetch !== "undefined") {
    fetch("/api/vitals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
  }
}

export function reportWebVitals(): void {
  onCLS(sendToAnalytics);
  onINP(sendToAnalytics);
  onLCP(sendToAnalytics);
  onFCP(sendToAnalytics);
  onTTFB(sendToAnalytics);
}