// Server-only helper that pulls teams + matches from football-data.org
// and upserts them into Supabase. Shared by the admin "Sync now" button
// and by the /api/public/hooks/sync-football cron endpoint (every 5 min).

import { supabaseAdmin } from "@/integrations/supabase/client.server";

const FD_BASE = "https://api.football-data.org/v4";
const FD_COMPETITION = process.env.FOOTBALL_COMPETITION ?? "WC";

interface FDTeam {
  id: number;
  name: string;
  tla: string;
  crest: string;
  coach?: { name?: string };
}

interface FDMatch {
  utcDate: string;
  status: string;
  stage: string;
  group?: string;
  homeTeam?: { tla?: string };
  awayTeam?: { tla?: string };
  score?: { fullTime?: { home?: number; away?: number } };
}

interface FDScorer {
  player?: { name?: string; nationality?: string };
  team?: { shortName?: string; tla?: string };
  goals?: number;
  assists?: number;
  penalties?: number;
}

async function fd<T>(path: string): Promise<T> {
  const key = process.env.FOOTBALL_API_KEY;
  if (!key) throw new Error("FOOTBALL_API_KEY ausente");
  const res = await fetch(`${FD_BASE}${path}`, { headers: { "X-Auth-Token": key } });
  if (!res.ok)
    throw new Error(`football-data ${path} → ${res.status} ${await res.text().catch(() => "")}`);
  return res.json() as Promise<T>;
}

function mapStatus(s: string): "scheduled" | "live" | "finished" | "postponed" | "cancelled" {
  switch (s) {
    case "FINISHED":
    case "AWARDED":
      return "finished";
    case "IN_PLAY":
    case "PAUSED":
    case "LIVE":
      return "live";
    case "POSTPONED":
    case "SUSPENDED":
      return "postponed";
    case "CANCELLED":
      return "cancelled";
    default:
      return "scheduled";
  }
}

function mapPhase(
  stage: string,
): "group" | "round_of_32" | "round_of_16" | "quarter" | "semi" | "third_place" | "final" {
  switch (stage) {
    case "LAST_32":
      return "round_of_32";
    case "LAST_16":
      return "round_of_16";
    case "QUARTER_FINALS":
      return "quarter";
    case "SEMI_FINALS":
      return "semi";
    case "THIRD_PLACE":
      return "third_place";
    case "FINAL":
      return "final";
    default:
      return "group";
  }
}

export type SyncResult = {
  ok: boolean;
  status: "success" | "error" | "skipped";
  message: string;
  summary?: { teams_upserted: number; matches_upserted: number; matches_updated: number };
};

export async function syncFootballData(triggeredBy: string): Promise<SyncResult> {
  const sb = supabaseAdmin;

  if (!process.env.FOOTBALL_API_KEY) {
    const message = "FOOTBALL_API_KEY não configurada.";
    await sb.from("api_sync_logs").insert({
      source: "football-data",
      action: "sync_all",
      status: "skipped",
      message,
      payload: { triggered_by: triggeredBy },
    });
    return { ok: false, status: "skipped", message };
  }

  const summary = {
    teams_upserted: 0,
    matches_upserted: 0,
    matches_updated: 0,
    scorers_upserted: 0,
  };
  try {
    // 1) Teams — upsert by code (UNIQUE)
    const teamsResp = await fd<{
      teams: Array<{
        id: number;
        name: string;
        tla: string;
        crest: string;
        coach?: { name?: string };
      }>;
    }>(`/competitions/${FD_COMPETITION}/teams`);
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

    // Garantir que exista uma seleção placeholder "A definir" (código TBD)
    // usada nos confrontos de mata-mata ainda não decididos.
    await sb
      .from("teams")
      .upsert(
        [{ name: "A definir", code: "TBD", flag_url: null, coach_name: null }],
        { onConflict: "code" },
      );

    const { data: teams } = await sb.from("teams").select("id, code");
    const teamByCode = new Map<string, string>((teams ?? []).map((t) => [t.code, t.id]));
    const tbdId = teamByCode.get("TBD");

    // 2) Matches — UPSERT (do NOT wipe, palpites cascade on match deletes)
    const matchesResp = await fd<{ matches: FDMatch[] }>(`/competitions/${FD_COMPETITION}/matches`);
    const { data: groups } = await sb.from("groups").select("id, name");
    const groupByName = new Map<string, string>(
      (groups ?? []).map((g) => [g.name.toUpperCase(), g.id]),
    );

    interface MatchRow {
      home_team_id: string;
      away_team_id: string;
      group_id: string | null;
      phase: "group" | "round_of_32" | "round_of_16" | "quarter" | "semi" | "third_place" | "final";
      kickoff_at: string;
      status: "scheduled" | "live" | "finished" | "postponed" | "cancelled";
      home_score: number;
      away_score: number;
    }
    const matchRows: MatchRow[] = [];
    for (const m of matchesResp.matches) {
      const homeCode = (m.homeTeam?.tla ?? "").toUpperCase();
      const awayCode = (m.awayTeam?.tla ?? "").toUpperCase();
      let homeId = teamByCode.get(homeCode);
      let awayId = teamByCode.get(awayCode);
      const stage = m.stage ?? "";
      const isKO = ["LAST_32", "LAST_16", "QUARTER_FINALS", "SEMI_FINALS", "THIRD_PLACE", "FINAL"].includes(stage);
      // Se for fase eliminatória (não group), usar placeholder TBD quando ainda não decidido
      if (!homeId || !awayId) {
        if (isKO && tbdId) {
          homeId = homeId ?? tbdId;
          awayId = awayId ?? tbdId;
        } else {
          continue;
        }
      }

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

    if (matchRows.length) {
      try {
        // Requires UNIQUE (home_team_id, away_team_id, kickoff_at) — added via migration.
        const { error, count } = await sb
          .from("matches")
          .upsert(matchRows, { onConflict: "home_team_id,away_team_id,kickoff_at", count: "exact" });
        if (error) throw error;
        summary.matches_upserted = matchRows.length;
        summary.matches_updated = count ?? 0;
      } catch (mErr) {
        const msg = mErr instanceof Error ? mErr.message : JSON.stringify(mErr);
        console.warn("Matches sync failed (non-fatal, continuando artilheiros):", msg);
      }
    }

    // 3) Scorers — fetch and upsert into dedicated table
    try {
      const scorersResp = await fd<{
        scorers: Array<{
          player: { name: string; nationality?: string };
          team: { shortName?: string; tla?: string };
          goals: number;
          assists?: number;
          penalties?: number;
        }>;
      }>(`/competitions/${FD_COMPETITION}/scorers?limit=200`);
      const scorersTeamCodes = new Map<string, string>();
      for (const [code, id] of teamByCode) scorersTeamCodes.set(code, id);

      const scorersRows = (scorersResp.scorers ?? [])
        .filter((s: FDScorer) => scorersTeamCodes.has((s.team?.tla ?? "").toUpperCase()))
        .map((s: FDScorer) => ({
          name: s.player?.name ?? "Desconhecido",
          team_code: (s.team?.tla ?? "").toUpperCase(),
          team_id: scorersTeamCodes.get((s.team?.tla ?? "").toUpperCase()),
          goals: s.goals ?? 0,
          assists: s.assists ?? 0,
          penalties: s.penalties ?? 0,
          nationality: s.player?.nationality ?? null,
        }));

      if (scorersRows.length) {
        await sb.from("scorers").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        const { error: sErr } = await sb.from("scorers").insert(scorersRows);
        if (sErr) throw sErr;
        summary.scorers_upserted = scorersRows.length;
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn("Scorers sync failed (non-fatal):", msg);
    }

    const message = `Sync OK: ${summary.teams_upserted} seleções, ${summary.matches_upserted} jogos, ${summary.scorers_upserted} artilheiros.`;
    await sb.from("api_sync_logs").insert({
      source: "football-data",
      action: "sync_all",
      status: "success",
      message,
      payload: { triggered_by: triggeredBy, ...summary },
    });
    return { ok: true, status: "success", message, summary };
  } catch (e: unknown) {
    let detail: string;
    if (e instanceof Error) detail = e.message;
    else if (e && typeof e === "object") {
      const anyE = e as { message?: string; details?: string; hint?: string; code?: string };
      detail = anyE.message ?? anyE.details ?? anyE.hint ?? JSON.stringify(e);
    } else detail = String(e);
    const message = `Falha na sincronização: ${detail}`;
    await sb.from("api_sync_logs").insert({
      source: "football-data",
      action: "sync_all",
      status: "error",
      message,
      payload: { triggered_by: triggeredBy, summary },
    });
    return { ok: false, status: "error", message };
  }
}
