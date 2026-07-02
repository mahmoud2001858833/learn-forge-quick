import { onCLS, onLCP, onINP, onTTFB, onFCP, type Metric } from "web-vitals";

let started = false;

function send(metric: Metric) {
  try {
    const body = JSON.stringify({
      metric: metric.name,
      value: metric.value,
      rating: metric.rating,
      url: window.location.href,
      path: window.location.pathname,
      user_agent: navigator.userAgent.slice(0, 200),
      tenant_slug: (window.location.pathname.match(/^\/t\/([^/]+)/)?.[1]) ?? null,
    });
    const url = "/api/public/hooks/rum";
    // sendBeacon is fire-and-forget and survives page unload
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
    } else {
      fetch(url, { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true });
    }
  } catch {
    /* noop */
  }
}

export function initRUM() {
  if (started || typeof window === "undefined") return;
  started = true;
  onCLS(send);
  onLCP(send);
  onINP(send);
  onTTFB(send);
  onFCP(send);
}
