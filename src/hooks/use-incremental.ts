import { useEffect, useMemo, useRef, useState } from "react";

type IdleHandle = number;

const requestIdle: (cb: () => void) => IdleHandle =
  typeof window !== "undefined" && (window as any).requestIdleCallback
    ? (cb) => (window as any).requestIdleCallback(cb, { timeout: 200 })
    : (cb) => window.setTimeout(cb, 16);

const cancelIdle = (h: IdleHandle) => {
  if (typeof window === "undefined") return;
  if ((window as any).cancelIdleCallback) (window as any).cancelIdleCallback(h);
  else window.clearTimeout(h);
};

/**
 * Incremental rendering: paint the first `initial` items immediately, then
 * stream the rest in during idle frames so the browser never blocks on
 * one giant render pass.
 */
export function useIncrementalList<T>(items: T[], initial = 9, step = 9) {
  const [count, setCount] = useState(() => Math.min(initial, items.length));
  const lengthRef = useRef(items.length);

  // Reset when the underlying list changes (filters, new data)
  useEffect(() => {
    lengthRef.current = items.length;
    setCount(Math.min(initial, items.length));
  }, [items, initial]);

  useEffect(() => {
    if (count >= items.length) return;
    const h = requestIdle(() => setCount((c) => Math.min(c + step, items.length)));
    return () => cancelIdle(h);
  }, [count, items.length, step]);

  const visible = useMemo(() => items.slice(0, count), [items, count]);
  return { visible, done: count >= items.length, count };
}
