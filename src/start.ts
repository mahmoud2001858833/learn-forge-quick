import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

/**
 * Internal performance tracking: times every server function and every page
 * request, and stores slow/failed ones so bottlenecks are visible in the
 * admin performance dashboard. Sampling + fire-and-forget writes keep the
 * overhead negligible.
 */
const timingFunctionMiddleware = createMiddleware({ type: "function" }).server(async ({ next, ...ctx }) => {
  const t0 = Date.now();
  const name = String((ctx as Record<string, unknown>).functionId ?? "server_fn");
  try {
    const result = await next();
    const { recordTiming } = await import("./lib/perf.server");
    recordTiming({ kind: "server_fn", name, durationMs: Date.now() - t0 });
    return result;
  } catch (error) {
    const { recordTiming } = await import("./lib/perf.server");
    recordTiming({
      kind: "server_fn",
      name,
      durationMs: Date.now() - t0,
      status: "error",
      errorMessage: (error as Error)?.message,
    });
    throw error;
  }
});

const timingRequestMiddleware = createMiddleware({ type: "request" }).server(async ({ next, request }) => {
  const t0 = Date.now();
  const result = await next();
  try {
    const url = new URL(request.url);
    // Skip static assets — only page/API requests are interesting.
    if (!/\.[a-z0-9]{2,5}$/i.test(url.pathname)) {
      const { recordTiming } = await import("./lib/perf.server");
      recordTiming({
        kind: url.pathname.startsWith("/api/") ? "api" : "request",
        name: `${request.method} ${url.pathname}`.slice(0, 200),
        durationMs: Date.now() - t0,
        tenantSlug: url.pathname.match(/^\/t\/([^/]+)/)?.[1] ?? null,
      });
    }
  } catch {
    /* never break the response */
  }
  return result;
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth, timingFunctionMiddleware],
  requestMiddleware: [errorMiddleware, timingRequestMiddleware],
}));

