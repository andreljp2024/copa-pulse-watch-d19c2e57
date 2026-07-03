// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
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
      "/client/icon-192.png": { redirect: "/icon-192.png" },
      "/client/icon-512.png": { redirect: "/icon-512.png" },
      "/client/apple-touch-icon.png": { redirect: "/apple-touch-icon.png" },
      "/favicon.ico": { redirect: "/icon-192.png" },
    },
  } as never,
});
