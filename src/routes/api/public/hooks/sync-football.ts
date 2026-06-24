import { createFileRoute } from "@tanstack/react-router";

// Public cron endpoint — called every 5 minutes by pg_cron to keep
// matches/teams/results fresh from football-data.org.
// Auth: requires the SUPABASE_PUBLISHABLE_KEY in the `apikey` header.
export const Route = createFileRoute("/api/public/hooks/sync-football")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") ?? request.headers.get("x-cron-secret") ?? request.headers.get("x-api-key");
        const expected = process.env.CRON_SECRET;
        if (!expected || !apikey || apikey !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401, headers: { "Content-Type": "application/json" },
          });
        }

        const { syncFootballData } = await import("@/lib/football-sync.server");
        const result = await syncFootballData("pg_cron");
        return new Response(JSON.stringify(result), {
          status: result.ok ? 200 : 500,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
