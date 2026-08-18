import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Longer freshness + retention → revisiting a page paints from cache
        // instantly instead of flashing a skeleton.
        staleTime: 5 * 60_000,
        gcTime: 30 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        retry: 1,
        // Keep the previous data on screen while a new key loads.
        placeholderData: <T,>(prev: T) => prev,
      },
    },
  });


  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadDelay: 30,
    defaultPreloadStaleTime: 60_000,
    defaultPreloadGcTime: 30 * 60_000,
    // Avoid pending-flash on fast transitions; when it does show, keep it brief.
    defaultPendingMs: 400,
    defaultPendingMinMs: 200,
  });


  return router;
};
