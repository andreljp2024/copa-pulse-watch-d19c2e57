import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export type TeamLite = { id?: string; name: string; code: string; flag_url?: string | null };

export function TeamBadge({ team, size = "md", className = "" }: { team: TeamLite; size?: "sm" | "md" | "lg"; className?: string }) {
  const sz = size === "lg" ? "h-10 w-14" : size === "sm" ? "h-5 w-7" : "h-7 w-10";
  return (
    <div className={`flex items-center gap-2 min-w-0 ${className}`}>
      {team.flag_url ? (
        <img src={team.flag_url} alt={team.name} className={`${sz} object-cover rounded-sm shrink-0 ring-1 ring-border`} loading="lazy" />
      ) : (
        <div className={`${sz} rounded-sm bg-muted grid place-items-center text-[10px] font-bold shrink-0`}>{team.code}</div>
      )}
      <span className="truncate font-semibold">{team.name}</span>
    </div>
  );
}

type MatchLike = {
  id: string;
  kickoff_at: string;
  status: string;
  home_score: number;
  away_score: number;
  home: TeamLite | null;
  away: TeamLite | null;
  stadium?: { name: string; city?: string | null } | null;
};

export function MatchCard({ m }: { m: MatchLike }) {
  const isLive = m.status === "live";
  const isFinished = m.status === "finished";
  return (
    <Link
      to="/partidas/$id"
      params={{ id: m.id }}
      className="block rounded-xl border border-border bg-card p-4 card-elevated hover:border-pitch/40 transition-colors"
    >
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
        <span suppressHydrationWarning>{format(new Date(m.kickoff_at), "EEE, dd MMM • HH:mm", { locale: ptBR })}</span>
        {isLive && (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-live/10 text-live font-bold">
            <span className="live-dot h-2 w-2 rounded-full" /> AO VIVO
          </span>
        )}
        {isFinished && <span className="px-2 py-0.5 rounded-full bg-muted font-semibold">Encerrado</span>}
        {!isLive && !isFinished && <span className="px-2 py-0.5 rounded-full bg-muted">Agendado</span>}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="min-w-0">{m.home && <TeamBadge team={m.home} />}</div>
        <div className="text-2xl font-black tabular-nums">
          {isFinished || isLive ? (
            <span>{m.home_score}<span className="text-muted-foreground mx-1">:</span>{m.away_score}</span>
          ) : (
            <span className="text-muted-foreground text-base font-bold">vs</span>
          )}
        </div>
        <div className="min-w-0 flex justify-end"><div className="flex-row-reverse flex"><div className="flex flex-row-reverse items-center gap-2 min-w-0">{m.away && <TeamBadge team={m.away} />}</div></div></div>
      </div>
      {m.stadium && (
        <div className="mt-3 text-xs text-muted-foreground truncate">{m.stadium.name}{m.stadium.city ? ` • ${m.stadium.city}` : ""}</div>
      )}
    </Link>
  );
}
