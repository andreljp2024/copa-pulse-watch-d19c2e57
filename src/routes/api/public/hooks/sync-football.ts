import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron endpoint público — chamado a cada 10 min por pg_cron.
 * Sincroniza dados da Copa 2026 usando football-data.org como fonte.
 * Segurança: valida o header `apikey` contra SUPABASE_PUBLISHABLE_KEY.
 */
export const Route = createFileRoute("/api/public/hooks/sync-football")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey") ?? request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
        const expected =
          process.env.SUPABASE_PUBLISHABLE_KEY ??
          process.env.SUPABASE_ANON_KEY ??
          process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        if (!expected || apikey !== expected) {
          return new Response(
            JSON.stringify({ error: "unauthorized", hasExpected: !!expected }),
            { status: 401, headers: { "Content-Type": "application/json" } },
          );
        }


        try {
          // Estratégia unificada: worldcup26.ir primária, football-data.org
          // fallback. Executar uma única API por ciclo evita duplicidade
          // em `matches` (kickoff_at diverge entre as fontes).
          const { syncMatchesUnified } = await import("@/lib/sync-with-fallback.server");
          const result = await syncMatchesUnified("cron:pg_cron");
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
