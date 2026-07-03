// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      strategies: "generateSW",
      filename: "sw.js",
      manifest: false,
      devOptions: { enabled: false },
      workbox: {
        navigateFallback: null,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff2}"],
        navigationPreload: true,
        importScripts: ["/push-sw.js"],
        runtimeCaching: [
          // HTML de rotas: NetworkFirst com timeout curto → fallback ao cache offline
          {
            urlPattern: ({ request, url }) =>
              request.mode === "navigate" && !url.pathname.startsWith("/~oauth"),
            handler: "NetworkFirst",
            options: {
              cacheName: "html-pages",
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          // Bandeiras (FlagCDN)
          {
            urlPattern: /^https:\/\/flagcdn\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "flags",
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Escudos/logos das seleções (football-data.org)
          {
            urlPattern: /^https:\/\/crests\.football-data\.org\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "crests",
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Assets Lovable CDN
          {
            urlPattern: /\/__l5e\/assets-v1\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "lovable-assets",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Assets do build (hash no nome)
          {
            urlPattern: /\/assets\/.*\.(?:js|css|woff2|png|svg|webp|jpg|jpeg)$/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "build-assets",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
  nitro: {
    preset: "node-server",
    routeRules: {
      "/rest/**": { proxy: "http://kong:8000/rest/**" },
      "/auth/v1/**": {
        proxy: { to: "http://kong:8000/auth/v1/**", fetchOptions: { redirect: "manual" } },
      },

      "/realtime/**": { proxy: "http://kong:8000/realtime/**" },
      "/evolution/**": { proxy: "http://evo-crm-evolution-api:8080/**" },
      "/sw.js": { headers: { "cache-control": "no-store, no-cache, must-revalidate, max-age=0" } },
      "/favicon.ico": { redirect: "/assets/bolaoai-icon-BWSdr3QL.png" },
    },
  } as never,
});
