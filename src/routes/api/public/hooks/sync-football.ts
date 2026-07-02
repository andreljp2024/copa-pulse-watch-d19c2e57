import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron endpoint público — chamado a cada 10 min por pg_cron.
 * Sincroniza dados da Copa 2026 usando football-data.org como fonte.
 * Segurança: valida o header `x-cron-secret` contra CRON_SECRET.
 */
export const Route = createFileRoute("/api/public/hooks/sync-football")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = request.headers.get("x-cron-secret");
        const expected = process.env.CRON_SECRET;
        if (!expected || secret !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        try {
          const { syncFootballData } = await import("@/lib/football-sync.server");
          const result = await syncFootballData("cron:pg_cron");
          return new Response(JSON.stringify({ ok: true, result }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return new Response(JSON.stringify({ ok: false, error: message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
