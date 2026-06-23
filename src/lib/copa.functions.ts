import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

// Public read-only client (publishable key). RLS applies as anon — all
// tables read here have explicit `TO anon` SELECT policies.
function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

const MATCH_SELECT =
  "*, home:home_team_id(name,code,flag_url), away:away_team_id(name,code,flag_url), stadium:stadium_id(name,city)";

function unwrap<T>(res: { data: T | null; error: { message: string } | null }, label: string): T {
  if (res.error) throw new Error(`[${label}] ${res.error.message}`);
  return (res.data ?? ([] as unknown as T));
}

export const getDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const now = new Date().toISOString();
  const [live, upcoming, recent, standings, scorers] = await Promise.all([
    sb.from("matches").select(MATCH_SELECT).eq("status", "live").order("kickoff_at"),
    sb.from("matches").select(MATCH_SELECT).eq("status", "scheduled").gte("kickoff_at", now).order("kickoff_at").limit(6),
    sb.from("matches").select(MATCH_SELECT).eq("status", "finished").order("kickoff_at", { ascending: false }).limit(6),
    sb.from("v_standings").select("*"),
    sb.from("v_top_scorers").select("*").limit(8),
  ]);
  return {
    live: unwrap(live, "live"),
    upcoming: unwrap(upcoming, "upcoming"),
    recent: unwrap(recent, "recent"),
    standings: unwrap(standings, "standings"),
    topScorers: unwrap(scorers, "topScorers"),
  };
});

export const listTeams = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const res = await sb.from("teams").select("*, group:group_id(name)").order("name");
  return unwrap(res, "listTeams");
});

export const getTeam = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const [team, players, matches] = await Promise.all([
      sb.from("teams").select("*, group:group_id(name)").eq("id", data.id).maybeSingle(),
      sb.from("players").select("*").eq("team_id", data.id).order("shirt_number"),
      sb
        .from("matches")
        .select("*, home:home_team_id(name,code,flag_url), away:away_team_id(name,code,flag_url)")
        .or(`home_team_id.eq.${data.id},away_team_id.eq.${data.id}`)
        .order("kickoff_at"),
    ]);
    if (team.error) throw new Error(`[getTeam] ${team.error.message}`);
    return {
      team: team.data,
      players: unwrap(players, "getTeam.players"),
      matches: unwrap(matches, "getTeam.matches"),
    };
  });

export const listGroups = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const [groups, standings] = await Promise.all([
    sb.from("groups").select("*").order("name"),
    sb.from("v_standings").select("*"),
  ]);
  return {
    groups: unwrap(groups, "listGroups.groups"),
    standings: unwrap(standings, "listGroups.standings"),
  };
});

export const listMatches = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const res = await sb
    .from("matches")
    .select(
      "*, home:home_team_id(id,name,code,flag_url), away:away_team_id(id,name,code,flag_url), group:group_id(name), stadium:stadium_id(name,city)",
    )
    .order("kickoff_at");
  return unwrap(res, "listMatches");
});

export const getMatch = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const [match, events, stats, lineups] = await Promise.all([
      sb
        .from("matches")
        .select(
          "*, home:home_team_id(id,name,code,flag_url,coach_name), away:away_team_id(id,name,code,flag_url,coach_name), stadium:stadium_id(name,city,country,capacity), referee:referee_id(name,country), group:group_id(name)",
        )
        .eq("id", data.id)
        .maybeSingle(),
      sb
        .from("match_events")
        .select("*, player:player_id(name), team:team_id(name,code,flag_url)")
        .eq("match_id", data.id)
        .order("minute"),
      sb.from("match_statistics").select("*").eq("match_id", data.id),
      sb.from("match_lineups").select("*, player:player_id(name)").eq("match_id", data.id),
    ]);
    if (match.error) throw new Error(`[getMatch] ${match.error.message}`);
    return {
      match: match.data,
      events: unwrap(events, "getMatch.events"),
      stats: unwrap(stats, "getMatch.stats"),
      lineups: unwrap(lineups, "getMatch.lineups"),
    };
  });

export const listTopScorers = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const res = await sb.from("v_top_scorers").select("*").limit(50);
  return unwrap(res, "listTopScorers");
});
