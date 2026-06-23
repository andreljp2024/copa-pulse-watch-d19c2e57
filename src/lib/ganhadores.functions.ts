import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Computa ganhadores do tenant atual:
 * Para cada match finalizado, marca como ganhador todo palpite PAGO
 * cujo placar bata exatamente com home_score x away_score.
 * Idempotente: o índice único (bolao_id, palpite_id) impede duplicação.
 */
export const computarGanhadores = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const { data: tenant } = await sb
      .from("tenants")
      .select("id")
      .eq("owner_user_id", context.userId)
      .maybeSingle();
    if (!tenant) throw new Error("Tenant não encontrado");

    const [{ data: matches }, { data: palpites }] = await Promise.all([
      sb.from("matches").select("id, home_score, away_score").eq("status", "finished"),
      sb
        .from("palpites")
        .select("id, bolao_id, match_id, torcedor_id, palpite_a, palpite_b")
        .eq("tenant_id", tenant.id)
        .eq("status_pagamento", "pago"),
    ]);

    const matchMap = new Map((matches ?? []).map((m) => [m.id, m]));
    const winners: Array<{
      tenant_id: string;
      bolao_id: string;
      match_id: string;
      torcedor_id: string;
      palpite_id: string;
    }> = [];

    for (const p of palpites ?? []) {
      const m = matchMap.get(p.match_id);
      if (!m || m.home_score == null || m.away_score == null) continue;
      if (p.palpite_a === m.home_score && p.palpite_b === m.away_score) {
        winners.push({
          tenant_id: tenant.id,
          bolao_id: p.bolao_id,
          match_id: p.match_id,
          torcedor_id: p.torcedor_id,
          palpite_id: p.id,
        });
      }
    }

    if (winners.length === 0) return { ok: true, inserted: 0, total_candidates: 0 };

    // upsert via insert ignorando duplicados (assumimos índice único em palpite_id)
    const { data, error } = await sb
      .from("ganhadores")
      .upsert(winners, { onConflict: "palpite_id", ignoreDuplicates: true })
      .select("id");
    if (error) throw error;

    return { ok: true, inserted: data?.length ?? 0, total_candidates: winners.length };
  });
