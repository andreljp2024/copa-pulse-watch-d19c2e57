import { createFileRoute } from "@tanstack/react-router";

/**
 * Dispatcher da fila `notification_queue`.
 * Pega itens pendentes, envia via Evolution API (quando configurada) e
 * atualiza status. Idempotente e seguro para rodar a cada minuto via pg_cron.
 * Autenticação: header `apikey` = SUPABASE_PUBLISHABLE_KEY (padrão dos hooks públicos).
 */
export const Route = createFileRoute("/api/public/hooks/dispatch-notifications")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey =
          request.headers.get("apikey") ??
          request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
        const expected =
          process.env.SUPABASE_PUBLISHABLE_KEY ??
          process.env.SUPABASE_ANON_KEY ??
          process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        if (!expected || apikey !== expected) {
          return json({ error: "unauthorized" }, 401);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Lock otimista: marca até 20 itens como 'sending' num único update
        const { data: locked, error: lockErr } = await supabaseAdmin
          .from("notification_queue")
          .select("id, tenant_id, numero_whatsapp, mensagem, tentativas")
          .eq("status", "pending")
          .neq("tipo", "push")
          .lte("scheduled_at", new Date().toISOString())
          .lt("tentativas", 5)
          .order("scheduled_at", { ascending: true })
          .limit(20);

        if (lockErr) return json({ error: lockErr.message }, 500);
        if (!locked || locked.length === 0) return json({ ok: true, processed: 0 });

        const ids = locked.map((r) => r.id);
        await supabaseAdmin
          .from("notification_queue")
          .update({ status: "sending" })
          .in("id", ids);

        // Cache de config por tenant
        const tenantIds = [...new Set(locked.map((r) => r.tenant_id))];
        const { data: cfgs } = await supabaseAdmin
          .from("tenant_whatsapp_config")
          .select("tenant_id, integracao_modo, evolution_base_url, evolution_api_key, evolution_instance")
          .in("tenant_id", tenantIds);
        const cfgByTenant = new Map(cfgs?.map((c) => [c.tenant_id, c]) ?? []);

        let sent = 0;
        let failed = 0;
        let skipped = 0;

        for (const item of locked) {
          const cfg = cfgByTenant.get(item.tenant_id);
          const active =
            cfg?.integracao_modo === "evolution" &&
            cfg?.evolution_base_url &&
            cfg?.evolution_api_key &&
            cfg?.evolution_instance;

          if (!active) {
            // Sem Evolution configurada: marca como 'skipped' — organizador
            // continua usando o link wa.me manualmente.
            await supabaseAdmin
              .from("notification_queue")
              .update({
                status: "skipped",
                ultimo_erro: "Evolution API não configurada para este tenant",
                sent_at: new Date().toISOString(),
              })
              .eq("id", item.id);
            skipped++;
            continue;
          }

          try {
            const number = onlyDigits(item.numero_whatsapp);
            const base = cfg!.evolution_base_url!.replace(/\/+$/, "");
            const url = `${base}/message/sendText/${encodeURIComponent(cfg!.evolution_instance!)}`;

            const resp = await fetch(url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: cfg!.evolution_api_key!,
              },
              body: JSON.stringify({ number, text: item.mensagem }),
              signal: AbortSignal.timeout(10_000),
            });

            if (!resp.ok) {
              const body = await resp.text().catch(() => "");
              throw new Error(`Evolution ${resp.status}: ${body.slice(0, 300)}`);
            }

            await supabaseAdmin
              .from("notification_queue")
              .update({
                status: "sent",
                sent_at: new Date().toISOString(),
                tentativas: item.tentativas + 1,
              })
              .eq("id", item.id);
            sent++;
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            const nextTry = item.tentativas + 1;
            // Backoff exponencial: 2^n minutos
            const delayMs = Math.min(60_000 * Math.pow(2, nextTry), 60 * 60_000);
            await supabaseAdmin
              .from("notification_queue")
              .update({
                status: nextTry >= 5 ? "failed" : "pending",
                tentativas: nextTry,
                ultimo_erro: message.slice(0, 500),
                scheduled_at: new Date(Date.now() + delayMs).toISOString(),
              })
              .eq("id", item.id);
            failed++;
          }
        }

        return json({ ok: true, processed: locked.length, sent, failed, skipped });
      },
    },
  },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function onlyDigits(s: string) {
  return (s ?? "").replace(/\D+/g, "");
}
