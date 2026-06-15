import { createFileRoute, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AppShell } from "@/components/AppShell";
import { TeamBadge } from "@/components/MatchCard";
import { getMatch } from "@/lib/copa.functions";
import { Goal, Square, ArrowLeftRight, MapPin, User } from "lucide-react";

const opts = (id: string) => queryOptions({ queryKey: ["match", id], queryFn: () => getMatch({ data: { id } }) });

export const Route = createFileRoute("/partidas/$id")({
  loader: ({ context, params }) => { context.queryClient.ensureQueryData(opts(params.id)); },
  component: Page,
  notFoundComponent: () => <AppShell><div className="mx-auto max-w-7xl px-4 py-16 text-center">Partida não encontrada.</div></AppShell>,
});

const eventIcon = (t: string) => t === "goal" || t === "penalty" ? <Goal className="h-4 w-4 text-pitch" /> :
  t === "yellow_card" ? <Square className="h-4 w-4 text-yellow-500 fill-yellow-500" /> :
  t === "red_card" ? <Square className="h-4 w-4 text-red-600 fill-red-600" /> :
  t === "substitution" ? <ArrowLeftRight className="h-4 w-4 text-muted-foreground" /> :
  <Goal className="h-4 w-4 text-muted-foreground" />;

function Page() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(opts(id));
  if (!data.match) throw notFound();
  const m = data.match as any;
  const isLive = m.status === "live";
  const showScore = m.status === "finished" || isLive;
  const home = m.home, away = m.away;
  const homeStats = data.stats.find((s: any) => s.team_id === home.id);
  const awayStats = data.stats.find((s: any) => s.team_id === away.id);

  return (
    <AppShell>
      <div className="bg-hero text-primary-foreground">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <div className="flex items-center justify-between text-xs font-semibold uppercase text-primary-foreground/80">
            <span>{m.phase === "group" ? `Fase de grupos${m.group?.name ? ` • Grupo ${m.group.name}` : ""}` : m.phase}</span>
            {isLive && <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-live text-primary-foreground">
              <span className="live-dot h-2 w-2 rounded-full bg-white" /> AO VIVO
            </span>}
          </div>
          <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <div className="text-center sm:text-right">
              {home.flag_url && <img src={home.flag_url} alt={home.name} className="mx-auto sm:ml-auto sm:mr-0 h-16 w-24 object-cover rounded-md ring-2 ring-white/30" />}
              <div className="mt-2 text-lg sm:text-2xl font-black">{home.name}</div>
              <div className="text-xs text-primary-foreground/70">Técnico: {home.coach_name ?? "—"}</div>
            </div>
            <div className="text-5xl sm:text-7xl font-black tabular-nums text-center">
              {showScore ? `${m.home_score} : ${m.away_score}` : <span className="text-2xl">vs</span>}
            </div>
            <div className="text-center sm:text-left">
              {away.flag_url && <img src={away.flag_url} alt={away.name} className="mx-auto sm:mr-auto sm:ml-0 h-16 w-24 object-cover rounded-md ring-2 ring-white/30" />}
              <div className="mt-2 text-lg sm:text-2xl font-black">{away.name}</div>
              <div className="text-xs text-primary-foreground/70">Técnico: {away.coach_name ?? "—"}</div>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-primary-foreground/85">
            <span>{format(new Date(m.kickoff_at), "EEEE, dd 'de' MMMM • HH:mm", { locale: ptBR })}</span>
            {m.stadium && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{m.stadium.name}{m.stadium.city ? `, ${m.stadium.city}` : ""}</span>}
            {m.referee?.name && <span className="inline-flex items-center gap-1"><User className="h-3.5 w-3.5" />{m.referee.name}</span>}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-10 grid gap-8 md:grid-cols-2">
        <section>
          <h2 className="text-xl font-black mb-4">Linha do tempo</h2>
          {data.events.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem eventos registrados.</p>
          ) : (
            <ol className="space-y-3">
              {data.events.map((e: any) => (
                <li key={e.id} className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-muted text-xs font-bold tabular-nums">{e.minute}'</span>
                  <div className="mt-0.5">{eventIcon(e.type)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">{e.player?.name ?? e.description ?? e.type}</div>
                    <div className="text-xs text-muted-foreground">{e.team?.name}</div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
        <section>
          <h2 className="text-xl font-black mb-4">Estatísticas</h2>
          {!homeStats && !awayStats ? (
            <p className="text-sm text-muted-foreground">Estatísticas indisponíveis.</p>
          ) : (
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              {[
                ["possession", "Posse de bola (%)"],
                ["shots", "Finalizações"],
                ["shots_on_target", "No gol"],
                ["corners", "Escanteios"],
                ["fouls", "Faltas"],
                ["offsides", "Impedimentos"],
                ["passes_accurate", "Passes certos"],
                ["saves", "Defesas"],
              ].map(([k, l]) => (
                <StatRow key={k} label={l} home={homeStats?.[k]} away={awayStats?.[k]} />
              ))}
            </div>
          )}
          {m.attendance && <p className="mt-4 text-sm text-muted-foreground">Público: <span className="font-semibold text-foreground">{m.attendance.toLocaleString("pt-BR")}</span></p>}
        </section>
      </div>
    </AppShell>
  );
}

function StatRow({ label, home, away }: { label: string; home?: number | null; away?: number | null }) {
  return (
    <div>
      <div className="flex justify-between text-xs font-semibold">
        <span className="tabular-nums">{home ?? "—"}</span>
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">{away ?? "—"}</span>
      </div>
      <div className="mt-1 flex h-2 gap-1">
        <div className="flex-1 bg-muted rounded overflow-hidden flex justify-end">
          <div className="h-full bg-pitch" style={{ width: `${pct(home, away)}%` }} />
        </div>
        <div className="flex-1 bg-muted rounded overflow-hidden">
          <div className="h-full bg-gold" style={{ width: `${pct(away, home)}%` }} />
        </div>
      </div>
    </div>
  );
}
function pct(a?: number | null, b?: number | null) {
  const x = a ?? 0, y = b ?? 0;
  const total = x + y;
  return total ? Math.round((x / total) * 100) : 0;
}
