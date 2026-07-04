import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            "vendor-charts": ["recharts"],
            "vendor-motion": ["framer-motion"],
            "vendor-editor": [
              "@tiptap/react",
              "@tiptap/starter-kit",
              "@tiptap/extension-image",
              "@tiptap/extension-link",
              "@tiptap/extension-placeholder",
              "@tiptap/extension-underline",
            ],
            "vendor-radix": [
              "@radix-ui/react-dialog",
              "@radix-ui/react-dropdown-menu",
              "@radix-ui/react-popover",
              "@radix-ui/react-select",
              "@radix-ui/react-tabs",
              "@radix-ui/react-tooltip",
            ],
          },
        },
      },
    },
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: null, // registration is handled by our guarded wrapper
        filename: "sw.js",
        strategies: "generateSW",
        devOptions: { enabled: false },
        manifest: false, // we ship /public/manifest.webmanifest ourselves
        workbox: {
          navigateFallback: "/",
          navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//, /^\/_serverFn\//],
          globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff2}"],
          cleanupOutdatedCaches: true,
          skipWaiting: true,
          clientsClaim: true,
          runtimeCaching: [
            {
              // HTML navigations — network first so users always get fresh routes
              urlPattern: ({ request }) => request.mode === "navigate",
              handler: "NetworkFirst",
              options: {
                cacheName: "html-pages",
                networkTimeoutSeconds: 3,
                expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 },
              },
            },
            {
              // Same-origin hashed JS/CSS/font assets — cache first
              urlPattern: ({ url, request }) =>
                url.origin === self.location.origin &&
                (request.destination === "script" ||
                  request.destination === "style" ||
                  request.destination === "font"),
              handler: "CacheFirst",
              options: {
                cacheName: "static-assets",
                expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
            {
              // Images
              urlPattern: ({ request }) => request.destination === "image",
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "images",
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
          ],
        },
      }),
    ],
  },
});
