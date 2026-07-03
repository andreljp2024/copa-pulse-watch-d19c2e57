import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { MatchCard, TeamBadge } from "@/components/MatchCard";
import { StandingsTable } from "@/components/StandingsTable";
import { getDashboard } from "@/lib/copa.functions";
import { Trophy, Goal, CalendarDays, Flame } from "lucide-react";
import heroStadium from "@/assets/hero-stadium.jpg";
import heroTrophy from "@/assets/hero-trophy.jpg";
import sectionPitch from "@/assets/section-pitch.jpg";

const dashboardOpts = queryOptions({
  queryKey: ["dashboard"],
  queryFn: () => getDashboard(),
  refetchInterval: 30_000,
  refetchIntervalInBackground: false,
  staleTime: 15_000,
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bolão AI — Painel da Copa do Mundo" },
      {
        name: "description",
        content:
          "Resumo da Copa: jogos ao vivo, próximos jogos, resultados, classificação e artilheiros.",
      },
      { property: "og:title", content: "Bolão AI — Painel da Copa do Mundo" },
      { property: "og:description", content: "Tudo da Copa em um só lugar." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(dashboardOpts);
  },
  component: Dashboard,
});

function Dashboard() {
  const { data } = useSuspenseQuery(dashboardOpts);
  const firstTwoGroups = useMemo(() => {
    const groupsMap = new Map<string, typeof data.standings>();
    for (const row of data.standings) {
      if (!row.group_id) continue;
      const arr = groupsMap.get(row.group_id) ?? [];
      arr.push(row);
      groupsMap.set(row.group_id, arr);
    }
    return [...groupsMap.entries()].slice(0, 2);
  }, [data.standings]);

  return (
    <AppShell>
      <section className="relative overflow-hidden bg-hero grain">
        <img
          src={heroStadium}
          alt=""
          aria-hidden="true"
          width={1920}
          height={1280}
          className="absolute inset-0 h-full w-full object-cover opacity-70 pointer-events-none select-none"
        />
        {/* Conic samba glow */}
        <div
          aria-hidden="true"
          className="absolute -top-40 -right-40 h-[36rem] w-[36rem] rounded-full opacity-30 blur-3xl animate-spin-slow pointer-events-none"
          style={{ backgroundImage: "var(--gradient-conic-gold)" }}
        />
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle at 2px 2px, var(--gold) 1px, transparent 0)",
            backgroundSize: "40px 40px",
          }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/55 to-background pointer-events-none"
          aria-hidden="true"
        />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-12 lg:py-24">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div className="space-y-5 sm:space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gradient-samba/10 px-3 py-1 text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gold backdrop-blur">
                <span
                  className="h-2 w-2 rounded-full bg-gradient-samba animate-pulse"
                  aria-hidden="true"
                />
                Vai, Brasil! · Rumo ao Hexa 2026
              </div>
              <h1 className="font-display text-4xl sm:text-6xl md:text-8xl lg:text-9xl leading-[0.9] uppercase text-white">
                Bolão dos <br />
                <span className="text-gradient-samba">Amigos Brasileiros</span>
              </h1>
              <p className="max-w-md text-sm sm:text-base md:text-lg leading-relaxed text-muted-foreground">
                Acompanhe cada lance, simule resultados e dispute o topo do ranking no maior portal
                da Copa do Mundo 2026.
              </p>
              <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 pt-2">
                <Link
                  to="/criar-bolao"
                  className="inline-flex h-12 items-center justify-center rounded-sm bg-gradient-gold px-6 sm:px-8 text-sm font-black uppercase tracking-tight text-gold-foreground shadow-gold transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Criar Meu Bolão
                </Link>
                <Link
                  to="/calendario"
                  className="inline-flex h-12 items-center justify-center rounded-sm border border-border bg-card/40 px-6 sm:px-8 text-sm font-black uppercase tracking-tight text-foreground backdrop-blur transition-colors hover:bg-card/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                >
                  <CalendarDays className="mr-2 h-4 w-4" aria-hidden="true" /> Ver Calendário
                </Link>
              </div>
            </div>

            {/* Trophy hero card */}
            <div className="h-[320px] sm:h-[500px]">
              <Link
                to="/criar-bolao"
                className="group relative overflow-hidden h-full w-full rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-900 p-4 sm:p-6 flex flex-col items-center justify-center transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-background shadow-2xl"
              >
                <div
                  className="absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--gold)/0.25),transparent_60%)] pointer-events-none"
                  aria-hidden="true"
                />
                <div className="relative flex h-40 w-40 sm:h-56 sm:w-56 items-center justify-center rounded-full bg-emerald-500/20 ring-4 ring-emerald-400/30 backdrop-blur-sm transition-transform duration-500 group-hover:scale-110">
                  <div className="absolute inset-2 rounded-full bg-emerald-600/40 ring-2 ring-emerald-300/40" aria-hidden="true" />
                  <Trophy
                    className="relative h-20 w-20 sm:h-28 sm:w-28 text-gold drop-shadow-[0_4px_12px_rgba(0,0,0,0.4)]"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                </div>
                <h3 className="relative mt-6 font-display text-3xl sm:text-5xl leading-none text-center text-white">
                  CRIE SEU
                  <br />
                  BOLÃO
                </h3>
                <p className="relative mt-3 text-[10px] sm:text-xs font-bold uppercase tracking-widest text-emerald-100/80">
                  Prêmios exclusivos
                </p>
              </Link>
            </div>
          </div>

          {/* Stats bar */}
          <div className="mt-10 sm:mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-8 py-6 sm:py-10 border-y border-border">
            {[
              { v: String(data.stats.teams), l: "Seleções" },
              { v: String(data.stats.matches), l: "Partidas" },
              { v: String(data.stats.stadiums), l: "Cidades Sede" },
              {
                v: String(data.live.length),
                l: "Ao Vivo Agora",
              },
            ].map((s) => (
              <div key={s.l} className="text-center">
                <p className="font-display text-3xl sm:text-4xl md:text-5xl text-gold">{s.v}</p>
                <p className="mt-1 text-[10px] sm:text-xs uppercase tracking-widest text-muted-foreground">
                  {s.l}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div
        className="relative"
        style={{
          backgroundImage: `linear-gradient(to bottom, hsl(var(--background)) 0%, hsl(var(--background)/0.92) 30%, hsl(var(--background)/0.92) 70%, hsl(var(--background)) 100%), url(${sectionPitch})`,
          backgroundSize: "cover, 1200px auto",
          backgroundPosition: "center, center top",
          backgroundAttachment: "scroll, fixed",
          backgroundRepeat: "no-repeat, repeat-y",
        }}
      >
      <div className="mx-auto max-w-7xl px-4 py-10 space-y-12">
        {data.live.length > 0 && (
          <section>
            <SectionTitle icon={<Flame className="h-5 w-5 text-live" />}>
              Ao vivo agora
            </SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.live.map((m: any) => (
                <MatchCard key={m.id} m={m} />
              ))}
            </div>
          </section>
        )}

        <section>
          <SectionTitle
            icon={<CalendarDays className="h-5 w-5 text-pitch" />}
            action={
              <Link to="/calendario" className="text-sm font-semibold text-pitch hover:underline">
                Ver todos →
              </Link>
            }
          >
            Próximos jogos
          </SectionTitle>
          {data.upcoming.length === 0 ? (
            <Empty text="Sem jogos agendados no momento." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.upcoming.map((m: any) => (
                <MatchCard key={m.id} m={m} />
              ))}
            </div>
          )}
        </section>

        <section>
          <SectionTitle icon={<Goal className="h-5 w-5 text-pitch" />}>
            Últimos resultados
          </SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.recent.map((m: any) => (
              <MatchCard key={m.id} m={m} />
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <SectionTitle icon={<Trophy className="h-5 w-5 text-gold" />}>
              Classificação dos grupos
            </SectionTitle>
            <div className="grid gap-4 md:grid-cols-2">
              {firstTwoGroups.map(([gid, rows]) => (
                <div
                  key={gid}
                  className="rounded-xl border border-border bg-card p-4 card-elevated"
                >
                  <h3 className="text-sm font-black uppercase text-pitch mb-2">Grupo</h3>
                  <StandingsTable rows={rows as any} />
                </div>
              ))}
            </div>
            <Link
              to="/grupos"
              className="inline-block text-sm font-semibold text-pitch hover:underline"
            >
              Ver todos os grupos →
            </Link>
          </div>
          <div>
            <SectionTitle icon={<Goal className="h-5 w-5 text-gold" />}>Artilheiros</SectionTitle>
            <div className="rounded-xl border border-border bg-card p-4 card-elevated">
              {data.topScorers.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem gols registrados ainda.</p>
              ) : (
                <ol className="space-y-2">
                  {data.topScorers.map((s: any, i: number) => (
                    <li key={s.player_id} className="flex items-center gap-3">
                      <span
                        className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${i === 0 ? "bg-gold text-accent-foreground" : "bg-muted"}`}
                      >
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold truncate">{s.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{s.team_name}</div>
                      </div>
                      <TeamBadge
                        team={{ name: s.team_name, code: s.team_code, flag_url: s.flag_url }}
                        size="sm"
                        className="hidden sm:flex"
                      />
                      <span className="text-lg font-black tabular-nums text-pitch">{s.goals}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </section>
      </div>
      </div>
    </AppShell>
  );
}

function SectionTitle({
  icon,
  children,
  action,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-2 border-b border-border/60 pb-3">
      <h2 className="font-display text-2xl sm:text-3xl uppercase tracking-wide flex items-center gap-3">
        <span className="inline-block h-6 w-1 bg-gradient-gold rounded-sm" aria-hidden="true" />
        {icon}
        {children}
      </h2>
      {action}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
