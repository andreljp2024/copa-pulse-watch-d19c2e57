import { Link } from "@tanstack/react-router";
import { TeamBadge } from "./MatchCard";

type Row = {
  team_id: string;
  group_id: string | null;
  name: string;
  code: string;
  flag_url: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
  points: number;
};

export function StandingsTable({ rows, highlightTop = 2 }: { rows: Row[]; highlightTop?: number }) {
  const sorted = [...rows].sort((a, b) => b.points - a.points || b.goal_diff - a.goal_diff || b.goals_for - a.goals_for);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs uppercase text-muted-foreground">
          <tr className="border-b border-border">
            <th className="text-left py-2 pl-3">#</th>
            <th className="text-left py-2">Seleção</th>
            <th className="text-center py-2">J</th>
            <th className="text-center py-2">V</th>
            <th className="text-center py-2">E</th>
            <th className="text-center py-2">D</th>
            <th className="text-center py-2">GP</th>
            <th className="text-center py-2">GC</th>
            <th className="text-center py-2">SG</th>
            <th className="text-center py-2 pr-3 font-bold">P</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={r.team_id} className="border-b border-border/60 hover:bg-muted/40">
              <td className="py-2 pl-3">
                <span className={`inline-grid place-items-center h-6 w-6 rounded-full text-xs font-bold ${i < highlightTop ? "bg-pitch text-primary-foreground" : "bg-muted"}`}>{i + 1}</span>
              </td>
              <td className="py-2">
                <Link to="/selecoes/$id" params={{ id: r.team_id }} className="hover:underline">
                  <TeamBadge team={{ name: r.name, code: r.code, flag_url: r.flag_url }} size="sm" />
                </Link>
              </td>
              <td className="text-center tabular-nums">{r.played}</td>
              <td className="text-center tabular-nums">{r.wins}</td>
              <td className="text-center tabular-nums">{r.draws}</td>
              <td className="text-center tabular-nums">{r.losses}</td>
              <td className="text-center tabular-nums">{r.goals_for}</td>
              <td className="text-center tabular-nums">{r.goals_against}</td>
              <td className="text-center tabular-nums">{r.goal_diff > 0 ? `+${r.goal_diff}` : r.goal_diff}</td>
              <td className="text-center pr-3 font-bold tabular-nums">{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
