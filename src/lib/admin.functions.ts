import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden: admin role required");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const isAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    return { isAdmin: !!data };
  });

export const claimFirstAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = await admin();
    // Já é admin? idempotente.
    const { data: already } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (already) return { ok: true, alreadyAdmin: true as const };

    const { count } = await sb.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "admin");
    if ((count ?? 0) > 0) {
      return { ok: false as const, message: "Já existe um administrador. Peça promoção a um administrador existente." };
    }
    const { error } = await sb.from("user_roles").insert({ user_id: context.userId, role: "admin" });
    if (error) return { ok: false as const, message: "Não foi possível conceder acesso de administrador." };
    return { ok: true as const, alreadyAdmin: false };
  });

const matchSchema = z.object({
  id: z.string().uuid().optional(),
  home_team_id: z.string().uuid(),
  away_team_id: z.string().uuid(),
  group_id: z.string().uuid().nullable().optional(),
  phase: z.enum(["group", "round_of_16", "quarter", "semi", "third_place", "final"]),
  stadium_id: z.string().uuid().nullable().optional(),
  kickoff_at: z.string(),
  status: z.enum(["scheduled", "live", "finished", "postponed", "cancelled"]),
  home_score: z.number().int().min(0),
  away_score: z.number().int().min(0),
});

export const upsertMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => matchSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = await admin();
    const { error } = data.id
      ? await sb.from("matches").update(data).eq("id", data.id)
      : await sb.from("matches").insert(data);
    if (error) throw error;
    return { ok: true };
  });

export const deleteMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = await admin();
    const { error } = await sb.from("matches").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

const teamSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  code: z.string().min(2).max(4),
  flag_url: z.string().url().optional().nullable(),
  confederation: z.string().optional().nullable(),
  group_id: z.string().uuid().nullable().optional(),
  coach_name: z.string().optional().nullable(),
  fifa_rank: z.number().int().nullable().optional(),
});

export const upsertTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => teamSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = await admin();
    const { error } = data.id
      ? await sb.from("teams").update(data).eq("id", data.id)
      : await sb.from("teams").insert(data);
    if (error) throw error;
    return { ok: true };
  });

// ---------- football-data.org integration ----------
const FD_BASE = "https://api.football-data.org/v4";
const FD_COMPETITION = process.env.FOOTBALL_COMPETITION ?? "WC"; // FIFA World Cup

async function fd<T>(path: string): Promise<T> {
  const key = process.env.FOOTBALL_API_KEY;
  if (!key) throw new Error("FOOTBALL_API_KEY ausente");
  const res = await fetch(`${FD_BASE}${path}`, { headers: { "X-Auth-Token": key } });
  if (!res.ok) throw new Error(`football-data ${path} → ${res.status} ${await res.text().catch(() => "")}`);
  return res.json() as Promise<T>;
}

function mapStatus(s: string): "scheduled" | "live" | "finished" | "postponed" | "cancelled" {
  switch (s) {
    case "FINISHED": case "AWARDED": return "finished";
    case "IN_PLAY": case "PAUSED": case "LIVE": return "live";
    case "POSTPONED": case "SUSPENDED": return "postponed";
    case "CANCELLED": return "cancelled";
    default: return "scheduled";
  }
}

function mapPhase(stage: string): "group" | "round_of_16" | "quarter" | "semi" | "third_place" | "final" {
  switch (stage) {
    case "LAST_16": return "round_of_16";
    case "QUARTER_FINALS": return "quarter";
    case "SEMI_FINALS": return "semi";
    case "THIRD_PLACE": return "third_place";
    case "FINAL": return "final";
    default: return "group";
  }
}

export const syncFromExternalApi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const sb = await admin();

    if (!process.env.FOOTBALL_API_KEY) {
      const message = "FOOTBALL_API_KEY não configurada.";
      await sb.from("api_sync_logs").insert({ source: "football-data", action: "sync_all", status: "skipped", message, payload: {} });
      return { ok: false, status: "skipped", message };
    }

    const summary = { teams_upserted: 0, matches_upserted: 0, groups_upserted: 0 };
    try {
      // 1) Teams
      const teamsResp = await fd<{ teams: Array<{ id: number; name: string; tla: string; crest: string; coach?: { name?: string } }> }>(
        `/competitions/${FD_COMPETITION}/teams`,
      );
      const teamRows = teamsResp.teams.map((t) => ({
        name: t.name,
        code: (t.tla ?? t.name.slice(0, 3)).toUpperCase(),
        flag_url: t.crest ?? null,
        coach_name: t.coach?.name ?? null,
      }));
      if (teamRows.length) {
        const { error } = await sb.from("teams").upsert(teamRows, { onConflict: "code" });
        if (error) throw error;
        summary.teams_upserted = teamRows.length;
      }

      // Build code → id map
      const { data: teams } = await sb.from("teams").select("id, code");
      const teamByCode = new Map<string, string>((teams ?? []).map((t: any) => [t.code, t.id]));

      // 2) Matches
      const matchesResp = await fd<{ matches: Array<any> }>(`/competitions/${FD_COMPETITION}/matches`);
      const { data: groups } = await sb.from("groups").select("id, name");
      const groupByName = new Map<string, string>((groups ?? []).map((g: any) => [g.name.toUpperCase(), g.id]));

      const matchRows: any[] = [];
      for (const m of matchesResp.matches) {
        const homeCode = (m.homeTeam?.tla ?? "").toUpperCase();
        const awayCode = (m.awayTeam?.tla ?? "").toUpperCase();
        const homeId = teamByCode.get(homeCode);
        const awayId = teamByCode.get(awayCode);
        if (!homeId || !awayId) continue;
        let groupId: string | null = null;
        if (m.group && typeof m.group === "string") {
          const letter = m.group.replace(/^GROUP_/, "").toUpperCase();
          groupId = groupByName.get(letter) ?? null;
        }
        matchRows.push({
          home_team_id: homeId,
          away_team_id: awayId,
          group_id: groupId,
          phase: mapPhase(m.stage ?? "GROUP_STAGE"),
          kickoff_at: m.utcDate,
          status: mapStatus(m.status ?? "SCHEDULED"),
          home_score: m.score?.fullTime?.home ?? 0,
          away_score: m.score?.fullTime?.away ?? 0,
        });
      }
      // No unique constraint on (home,away,kickoff) — clear scheduled-future stub and re-insert.
      // Safer: delete all matches sourced from API by simple strategy → wipe and re-insert.
      if (matchRows.length) {
        await sb.from("matches").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        const { error } = await sb.from("matches").insert(matchRows);
        if (error) throw error;
        summary.matches_upserted = matchRows.length;
      }

      const message = `Sync OK: ${summary.teams_upserted} seleções, ${summary.matches_upserted} jogos.`;
      await sb.from("api_sync_logs").insert({
        source: "football-data",
        action: "sync_all",
        status: "success",
        message,
        payload: { triggered_by: context.userId, ...summary },
      });
      return { ok: true, status: "success", message };
    } catch (e: any) {
      const message = `Falha na sincronização: ${e.message ?? String(e)}`;
      await sb.from("api_sync_logs").insert({
        source: "football-data",
        action: "sync_all",
        status: "error",
        message,
        payload: { triggered_by: context.userId },
      });
      return { ok: false, status: "error", message };
    }
  });

export const listSyncLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const sb = await admin();
    const { data } = await sb.from("api_sync_logs").select("*").order("created_at", { ascending: false }).limit(50);
    return data ?? [];
  });
