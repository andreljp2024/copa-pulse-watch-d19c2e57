import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const getDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const sb = await admin();
  const now = new Date().toISOString();
  const [live, upcoming, recent, standings, scorers] = await Promise.all([
    sb.from("matches").select("*, home:home_team_id(name,code,flag_url), away:away_team_id(name,code,flag_url), stadium:stadium_id(name,city)").eq("status", "live").order("kickoff_at"),
    sb.from("matches").select("*, home:home_team_id(name,code,flag_url), away:away_team_id(name,code,flag_url), stadium:stadium_id(name,city)").eq("status", "scheduled").gte("kickoff_at", now).order("kickoff_at").limit(6),
    sb.from("matches").select("*, home:home_team_id(name,code,flag_url), away:away_team_id(name,code,flag_url), stadium:stadium_id(name,city)").eq("status", "finished").order("kickoff_at", { ascending: false }).limit(6),
    sb.from("v_standings").select("*"),
    sb.from("v_top_scorers").select("*").limit(8),
  ]);
  return {
    live: live.data ?? [],
    upcoming: upcoming.data ?? [],
    recent: recent.data ?? [],
    standings: standings.data ?? [],
    topScorers: scorers.data ?? [],
  };
});

export const listTeams = createServerFn({ method: "GET" }).handler(async () => {
  const sb = await admin();
  const { data } = await sb.from("teams").select("*, group:group_id(name)").order("name");
  return data ?? [];
});

export const getTeam = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const sb = await admin();
    const [team, players, matches] = await Promise.all([
      sb.from("teams").select("*, group:group_id(name)").eq("id", data.id).maybeSingle(),
      sb.from("players").select("*").eq("team_id", data.id).order("shirt_number"),
      sb.from("matches").select("*, home:home_team_id(name,code,flag_url), away:away_team_id(name,code,flag_url)").or(`home_team_id.eq.${data.id},away_team_id.eq.${data.id}`).order("kickoff_at"),
    ]);
    return { team: team.data, players: players.data ?? [], matches: matches.data ?? [] };
  });

export const listGroups = createServerFn({ method: "GET" }).handler(async () => {
  const sb = await admin();
  const [groups, standings] = await Promise.all([
    sb.from("groups").select("*").order("name"),
    sb.from("v_standings").select("*"),
  ]);
  return { groups: groups.data ?? [], standings: standings.data ?? [] };
});

export const listMatches = createServerFn({ method: "GET" }).handler(async () => {
  const sb = await admin();
  const { data } = await sb
    .from("matches")
    .select("*, home:home_team_id(id,name,code,flag_url), away:away_team_id(id,name,code,flag_url), group:group_id(name), stadium:stadium_id(name,city)")
    .order("kickoff_at");
  return data ?? [];
});

export const getMatch = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const sb = await admin();
    const [match, events, stats, lineups] = await Promise.all([
      sb.from("matches").select("*, home:home_team_id(id,name,code,flag_url,coach_name), away:away_team_id(id,name,code,flag_url,coach_name), stadium:stadium_id(name,city,country,capacity), referee:referee_id(name,country), group:group_id(name)").eq("id", data.id).maybeSingle(),
      sb.from("match_events").select("*, player:player_id(name), team:team_id(name,code,flag_url)").eq("match_id", data.id).order("minute"),
      sb.from("match_statistics").select("*").eq("match_id", data.id),
      sb.from("match_lineups").select("*, player:player_id(name)").eq("match_id", data.id),
    ]);
    return { match: match.data, events: events.data ?? [], stats: stats.data ?? [], lineups: lineups.data ?? [] };
  });

export const listTopScorers = createServerFn({ method: "GET" }).handler(async () => {
  const sb = await admin();
  const { data } = await sb.from("v_top_scorers").select("*").limit(50);
  return data ?? [];
});
