import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type GanhadorRow = {
  id: string;
  bolao_id: string;
  bolao_nome: string;
  bolao_slug: string;
  percentual_admin: number;
  match_id: string;
  home_team: string | null;
  away_team: string | null;
  home_flag: string | null;
  away_flag: string | null;
  home_score: number | null;
  away_score: number | null;
  torcedor_id: string;
  nome: string;
  whatsapp: string;
  palpite_id: string;
  codigo: number;
  palpite_a: number;
  palpite_b: number;
  valor_palpite: number;
};

export type GanhadoresBolaoGroup = {
  bolao_id: string;
  bolao_nome: string;
  bolao_slug: string;
  percentual_admin: number;
  arrecadado: number;
  taxa_admin: number;
  premio_total: number;
  premio_por_ganhador: number;
  ganhadores: GanhadorRow[];
};

export const listarGanhadores = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GanhadoresBolaoGroup[]> => {
    const sb = context.supabase;
    const { data: tenant } = await sb
      .from("tenants")
      .select("id")
      .eq("owner_user_id", context.userId)
      .maybeSingle();
    if (!tenant) return [];

    const { data: ganhadores, error: gErr } = await sb
      .from("ganhadores")
      .select(
        `id, bolao_id, match_id, torcedor_id, palpite_id,
         boloes!inner(id, nome, slug, percentual_admin),
         torcedores!inner(id, nome, whatsapp),
         palpites!inner(id, codigo, palpite_a, palpite_b, valor),
         matches!inner(id, home_score, away_score,
           home_team:teams!matches_home_team_id_fkey(name, flag_url),
           away_team:teams!matches_away_team_id_fkey(name, flag_url))`,
      )
      .eq("tenant_id", tenant.id);
    if (gErr) throw gErr;

    // Arrecadado por bolão (palpites pagos)
    const { data: pagos } = await sb
      .from("palpites")
      .select("bolao_id, valor")
      .eq("tenant_id", tenant.id)
      .eq("status_pagamento", "pago");

    const arrecadadoMap = new Map<string, number>();
    for (const p of pagos ?? []) {
      arrecadadoMap.set(p.bolao_id, (arrecadadoMap.get(p.bolao_id) ?? 0) + Number(p.valor ?? 0));
    }

    const grupos = new Map<string, GanhadoresBolaoGroup>();
    for (const g of (ganhadores ?? []) as unknown as Array<{
      id: string;
      bolao_id: string;
      match_id: string;
      torcedor_id: string;
      palpite_id: string;
      boloes: { id: string; nome: string; slug: string; percentual_admin: number };
      torcedores: { id: string; nome: string; whatsapp: string };
      palpites: { id: string; codigo: number; palpite_a: number; palpite_b: number; valor: number };
      matches: {
        id: string;
        home_score: number | null;
        away_score: number | null;
        home_team: { name: string; flag_url: string | null } | null;
        away_team: { name: string; flag_url: string | null } | null;
      };
    }>) {
      const row: GanhadorRow = {
        id: g.id,
        bolao_id: g.bolao_id,
        bolao_nome: g.boloes.nome,
        bolao_slug: g.boloes.slug,
        percentual_admin: Number(g.boloes.percentual_admin ?? 0),
        match_id: g.match_id,
        home_team: g.matches.home_team?.name ?? null,
        away_team: g.matches.away_team?.name ?? null,
        home_flag: g.matches.home_team?.flag_url ?? null,
        away_flag: g.matches.away_team?.flag_url ?? null,
        home_score: g.matches.home_score,
        away_score: g.matches.away_score,
        torcedor_id: g.torcedor_id,
        nome: g.torcedores.nome,
        whatsapp: g.torcedores.whatsapp,
        palpite_id: g.palpite_id,
        codigo: g.palpites.codigo,
        palpite_a: g.palpites.palpite_a,
        palpite_b: g.palpites.palpite_b,
        valor_palpite: Number(g.palpites.valor ?? 0),
      };
      const existing = grupos.get(g.bolao_id);
      if (existing) existing.ganhadores.push(row);
      else {
        grupos.set(g.bolao_id, {
          bolao_id: g.bolao_id,
          bolao_nome: row.bolao_nome,
          bolao_slug: row.bolao_slug,
          percentual_admin: row.percentual_admin,
          arrecadado: 0,
          taxa_admin: 0,
          premio_total: 0,
          premio_por_ganhador: 0,
          ganhadores: [row],
        });
      }
    }

    for (const grp of grupos.values()) {
      grp.arrecadado = arrecadadoMap.get(grp.bolao_id) ?? 0;
      grp.taxa_admin = +(grp.arrecadado * (grp.percentual_admin / 100)).toFixed(2);
      grp.premio_total = +(grp.arrecadado - grp.taxa_admin).toFixed(2);
      grp.premio_por_ganhador =
        grp.ganhadores.length > 0 ? +(grp.premio_total / grp.ganhadores.length).toFixed(2) : 0;
    }

    return Array.from(grupos.values()).sort((a, b) => a.bolao_nome.localeCompare(b.bolao_nome));
  });
