// Sincronização a partir da API pública worldcup26.ir (WC 2026, 48 seleções,
// 104 jogos, sem token nos endpoints /get/*). Alimenta teams, stadiums,
// groups e matches com dados oficiais + placares em tempo real.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { fromZonedTime } from "date-fns-tz";

const WC_BASE = "https://worldcup26.ir";

type WCTeam = {
  id: string;
  name_en: string;
  fifa_code: string;
  flag: string;
  groups: string; // "A".."L"
};

type WCGame = {
  id: string;
  home_team_id: string;
  away_team_id: string;
  home_score: string;
  away_score: string;
  group: string;
  local_date: string; // "MM/DD/YYYY HH:mm" (horário local do estádio)
  stadium_id: string;
  finished: string; // "TRUE" | "FALSE"
  time_elapsed: string; // "notstarted" | "live" | "finished" | minuto
  type: string; // group | r32 | r16 | qf | sf | third | final
};

type WCStadium = {
  id: string;
  name_en: string;
  city_en: string;
  country_en: string;
  capacity: number;
};

type Phase = "group" | "round_of_32" | "round_of_16" | "quarter" | "semi" | "third_place" | "final";
type Status = "scheduled" | "live" | "finished" | "postponed" | "cancelled";

async function wc<T>(path: string): Promise<T> {
  const res = await fetch(`${WC_BASE}${path}`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`worldcup26 ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

function mapPhase(type: string): Phase {
  switch (type) {
    case "r32": return "round_of_32";
    case "r16": return "round_of_16";
    case "qf": return "quarter";
    case "sf": return "semi";
    case "third": return "third_place";
    case "final": return "final";
    default: return "group";
  }
}

function mapStatus(finished: string, elapsed: string): Status {
  if (finished === "TRUE" || elapsed === "finished") return "finished";
  if (elapsed && elapsed !== "notstarted") return "live";
  return "scheduled";
}

// TZ aproximada por país-sede. worldcup26.ir devolve horário local sem TZ.
function tzForCountry(country: string): string {
  const c = country.toLowerCase();
  if (c.includes("mexico") || c.includes("méxico")) return "America/Mexico_City";
  if (c.includes("canada") || c.includes("canadá")) return "America/Toronto";
  return "America/New_York"; // EUA (aproximação; abrange leste)
}

function parseKickoff(local: string, tz: string): string {
  // "06/11/2026 13:00" → ISO UTC
  const [datePart, timePart] = local.split(" ");
  const [mm, dd, yyyy] = datePart.split("/");
  const iso = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}T${timePart}:00`;
  return fromZonedTime(iso, tz).toISOString();
}

export type SyncResult = {
  ok: boolean;
  status: "success" | "error";
  message: string;
  summary?: { teams: number; stadiums: number; matches: number; live: number };
};

export async function syncWorldCup2026(triggeredBy: string): Promise<SyncResult> {
  const sb = supabaseAdmin;
  const summary = { teams: 0, stadiums: 0, matches: 0, live: 0 };

  try {
    // ---- 1. Buscar dados da API ----
    const [teamsRes, stadiumsRes, gamesRes] = await Promise.all([
      wc<{ teams: WCTeam[] }>("/get/teams"),
      wc<{ stadiums: WCStadium[] } | WCStadium[]>("/get/stadiums"),
      wc<{ games: WCGame[] }>("/get/games"),
    ]);
    const teams = teamsRes.teams;
    const stadiums = Array.isArray(stadiumsRes) ? stadiumsRes : stadiumsRes.stadiums;
    const games = gamesRes.games;

    // ---- 2. Groups (A..L) já devem existir; carregar mapa ----
    const { data: groupRows } = await sb.from("groups").select("id, name");
    const groupByName = new Map<string, string>((groupRows ?? []).map((g) => [g.name.toUpperCase(), g.id]));

    // ---- 3. Teams: upsert por code (fifa_code) ----
    const teamRows = teams.map((t) => ({
      name: t.name_en,
      code: (t.fifa_code ?? t.name_en.slice(0, 3)).toUpperCase(),
      flag_url: t.flag ?? null,
      group_id: groupByName.get(t.groups?.toUpperCase() ?? "") ?? null,
    }));
    if (teamRows.length) {
      const { error } = await sb.from("teams").upsert(teamRows, { onConflict: "code" });
      if (error) throw error;
      summary.teams = teamRows.length;
    }

    const { data: teamRowsAll } = await sb.from("teams").select("id, code");
    const teamByCode = new Map<string, string>((teamRowsAll ?? []).map((t) => [t.code, t.id]));
    // mapa: id externo (string "1".."48") → uuid interno via fifa_code
    const teamByExtId = new Map<string, string>();
    for (const t of teams) {
      const uuid = teamByCode.get(t.fifa_code.toUpperCase());
      if (uuid) teamByExtId.set(t.id, uuid);
    }

    // ---- 4. Stadiums: upsert por name (sem UNIQUE; select+insert manual) ----
    const { data: existingStadiums } = await sb.from("stadiums").select("id, name");
    const stadiumByName = new Map<string, string>((existingStadiums ?? []).map((s) => [s.name.toLowerCase(), s.id]));
    const stadiumByExtId = new Map<string, { id: string; tz: string }>();

    for (const s of stadiums) {
      const key = s.name_en.toLowerCase();
      let id = stadiumByName.get(key);
      if (!id) {
        const { data: ins, error } = await sb
          .from("stadiums")
          .insert({ name: s.name_en, city: s.city_en, country: s.country_en, capacity: s.capacity })
          .select("id")
          .single();
        if (error) throw error;
        id = ins.id;
        stadiumByName.set(key, id);
        summary.stadiums += 1;
      }
      stadiumByExtId.set(s.id, { id, tz: tzForCountry(s.country_en) });
    }

    // ---- 5. Matches: upsert (home,away,kickoff_at) ----
    const KO_TBD = teamByCode.get("TBD") ?? "00000000-0000-0000-0000-000000000001";
    interface MatchRow {
      home_team_id: string;
      away_team_id: string;
      group_id: string | null;
      phase: Phase;
      stadium_id: string | null;
      kickoff_at: string;
      status: Status;
      home_score: number;
      away_score: number;
    }
    const matchRows: MatchRow[] = [];
    for (const g of games) {
      const stadium = stadiumByExtId.get(g.stadium_id);
      const tz = stadium?.tz ?? "America/New_York";
      const kickoff = parseKickoff(g.local_date, tz);
      const phase = mapPhase(g.type);
      const status = mapStatus(g.finished, g.time_elapsed);
      const home = teamByExtId.get(g.home_team_id) ?? (phase !== "group" ? KO_TBD : undefined);
      const away = teamByExtId.get(g.away_team_id) ?? (phase !== "group" ? KO_TBD : undefined);
      if (!home || !away) continue;
      const groupId =
        phase === "group" && g.group ? (groupByName.get(g.group.toUpperCase()) ?? null) : null;
      matchRows.push({
        home_team_id: home,
        away_team_id: away,
        group_id: groupId,
        phase,
        stadium_id: stadium?.id ?? null,
        kickoff_at: kickoff,
        status,
        home_score: Number(g.home_score) || 0,
        away_score: Number(g.away_score) || 0,
      });
      if (status === "live") summary.live += 1;
    }

    if (matchRows.length) {
      const { error } = await sb
        .from("matches")
        .upsert(matchRows, { onConflict: "home_team_id,away_team_id,kickoff_at" });
      if (error) throw error;
      summary.matches = matchRows.length;
    }

    const message = `Sync WC26 OK: ${summary.teams} seleções, ${summary.stadiums} novos estádios, ${summary.matches} jogos (${summary.live} ao vivo).`;
    await sb.from("api_sync_logs").insert({
      source: "worldcup26.ir",
      action: "sync_all",
      status: "success",
      message,
      payload: { triggered_by: triggeredBy, ...summary },
    });
    return { ok: true, status: "success", message, summary };
  } catch (e: unknown) {
    const message = `Falha no sync WC26: ${e instanceof Error ? e.message : String(e)}`;
    await sb.from("api_sync_logs").insert({
      source: "worldcup26.ir",
      action: "sync_all",
      status: "error",
      message,
      payload: { triggered_by: triggeredBy },
    });
    return { ok: false, status: "error", message };
  }
}
