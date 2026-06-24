import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { memo } from "react";

export type TeamLite = { id?: string; name: string; code: string; flag_url?: string | null };

const TEAM_NAME_PT: Record<string, string> = {
  Brazil: "Brasil", Argentina: "Argentina", Uruguay: "Uruguai", Paraguay: "Paraguai",
  Colombia: "Colômbia", Ecuador: "Equador", Peru: "Peru", Bolivia: "Bolívia",
  Chile: "Chile", Venezuela: "Venezuela",
  Mexico: "México", "United States": "Estados Unidos", USA: "Estados Unidos",
  Canada: "Canadá", "Costa Rica": "Costa Rica", Panama: "Panamá", Jamaica: "Jamaica",
  Honduras: "Honduras",
  England: "Inglaterra", France: "França", Germany: "Alemanha", Spain: "Espanha",
  Portugal: "Portugal", Italy: "Itália", Netherlands: "Países Baixos", Holland: "Países Baixos",
  Belgium: "Bélgica", Croatia: "Croácia", Switzerland: "Suíça", Denmark: "Dinamarca",
  Sweden: "Suécia", Norway: "Noruega", Poland: "Polônia", Austria: "Áustria",
  Serbia: "Sérvia", Türkiye: "Turquia", Turkey: "Turquia", "Czech Republic": "Tchéquia", Czechia: "Tchéquia",
  Scotland: "Escócia", Wales: "País de Gales", Ireland: "Irlanda", Hungary: "Hungria",
  Greece: "Grécia", Romania: "Romênia", Ukraine: "Ucrânia", Russia: "Rússia",
  Morocco: "Marrocos", Senegal: "Senegal", Tunisia: "Tunísia", Algeria: "Argélia",
  Egypt: "Egito", Nigeria: "Nigéria", Cameroon: "Camarões", Ghana: "Gana",
  "Ivory Coast": "Costa do Marfim", "Côte d'Ivoire": "Costa do Marfim", "South Africa": "África do Sul",
  Japan: "Japão", "South Korea": "Coreia do Sul", "Korea Republic": "Coreia do Sul",
  Australia: "Austrália", "Saudi Arabia": "Arábia Saudita", Iran: "Irã", Qatar: "Catar",
  "United Arab Emirates": "Emirados Árabes Unidos", Iraq: "Iraque", "New Zealand": "Nova Zelândia",
};

export function ptTeamName(name?: string | null) {
  if (!name) return "";
  return TEAM_NAME_PT[name] ?? name;
}

export function TeamBadge({ team, size = "md", className = "" }: { team: TeamLite; size?: "sm" | "md" | "lg"; className?: string }) {
  const sz = size === "lg" ? "h-10 w-14" : size === "sm" ? "h-5 w-7" : "h-7 w-10";
  const displayName = ptTeamName(team.name);
  return (
    <div className={`flex items-center gap-2 min-w-0 ${className}`}>
      {team.flag_url ? (
        <img src={team.flag_url} alt={displayName} className={`${sz} object-cover rounded-sm shrink-0 ring-1 ring-border`} loading="lazy" />
      ) : (
        <div className={`${sz} rounded-sm bg-muted grid place-items-center text-[10px] font-bold shrink-0`}>{team.code}</div>
      )}
      <span className="truncate font-semibold">{displayName}</span>
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

export const MatchCard = memo(function MatchCard({ m }: { m: MatchLike }) {
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
});
