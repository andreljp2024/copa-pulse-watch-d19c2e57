import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { MatchCard, TeamBadge } from "@/components/MatchCard";
import { StandingsTable } from "@/components/StandingsTable";
import { getDashboard } from "@/lib/copa.functions";
import { Trophy, Goal, CalendarDays, Flame } from "lucide-react";

const dashboardOpts = queryOptions({ queryKey: ["dashboard"], queryFn: () => getDashboard() });

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CopaHub — Painel da Copa do Mundo" },
      { name: "description", content: "Resumo da Copa: jogos ao vivo, próximos jogos, resultados, classificação e artilheiros." },
      { property: "og:title", content: "CopaHub — Painel da Copa do Mundo" },
      { property: "og:description", content: "Tudo da Copa em um só lugar." },
    ],
  }),
  loader: ({ context }) => { context.queryClient.ensureQueryData(dashboardOpts); },
  component: Dashboard,
});

function Dashboard() {
  const { data } = useSuspenseQuery(dashboardOpts);
  const groupsMap = new Map<string, typeof data.standings>();
  for (const row of data.standings) {
    if (!row.group_id) continue;
    const arr = groupsMap.get(row.group_id) ?? [];
    arr.push(row);
    groupsMap.set(row.group_id, arr);
  }
  const firstTwoGroups = [...groupsMap.entries()].slice(0, 2);

  return (
    <AppShell>
      <section className="bg-hero text-primary-foreground">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:py-20">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary-foreground/80">
            <Trophy className="h-4 w-4" /> CopaHub • Edição Atual
          </div>
          <h1 className="mt-3 text-4xl sm:text-6xl font-black tracking-tight max-w-3xl">
            A Copa do Mundo em tempo real, num só lugar.
          </h1>
          <p className="mt-4 text-base sm:text-lg text-primary-foreground/85 max-w-2xl">
            Tabela, calendário, escalações, estatísticas e artilharia — atualizado automaticamente.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/calendario" className="inline-flex h-11 items-center rounded-xl bg-gold px-5 text-sm font-bold text-accent-foreground hover:opacity-90">
              <CalendarDays className="h-4 w-4 mr-2" /> Ver calendário
            </Link>
            <Link to="/grupos" className="inline-flex h-11 items-center rounded-xl bg-background/15 backdrop-blur px-5 text-sm font-bold text-primary-foreground hover:bg-background/25">
              Classificação
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-10 space-y-12">
        {data.live.length > 0 && (
          <section>
            <SectionTitle icon={<Flame className="h-5 w-5 text-live" />}>Ao vivo agora</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.live.map((m: any) => <MatchCard key={m.id} m={m} />)}
            </div>
          </section>
        )}

        <section>
          <SectionTitle icon={<CalendarDays className="h-5 w-5 text-pitch" />} action={<Link to="/calendario" className="text-sm font-semibold text-pitch hover:underline">Ver todos →</Link>}>
            Próximos jogos
          </SectionTitle>
          {data.upcoming.length === 0 ? (
            <Empty text="Sem jogos agendados no momento." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.upcoming.map((m: any) => <MatchCard key={m.id} m={m} />)}
            </div>
          )}
        </section>

        <section>
          <SectionTitle icon={<Goal className="h-5 w-5 text-pitch" />}>Últimos resultados</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.recent.map((m: any) => <MatchCard key={m.id} m={m} />)}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <SectionTitle icon={<Trophy className="h-5 w-5 text-gold" />}>Classificação dos grupos</SectionTitle>
            <div className="grid gap-4 md:grid-cols-2">
              {firstTwoGroups.map(([gid, rows]) => (
                <div key={gid} className="rounded-xl border border-border bg-card p-4 card-elevated">
                  <h3 className="text-sm font-black uppercase text-pitch mb-2">Grupo</h3>
                  <StandingsTable rows={rows as any} />
                </div>
              ))}
            </div>
            <Link to="/grupos" className="inline-block text-sm font-semibold text-pitch hover:underline">Ver todos os grupos →</Link>
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
                      <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${i === 0 ? "bg-gold text-accent-foreground" : "bg-muted"}`}>{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold truncate">{s.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{s.team_name}</div>
                      </div>
                      <TeamBadge team={{ name: s.team_name, code: s.team_code, flag_url: s.flag_url }} size="sm" className="hidden sm:flex" />
                      <span className="text-lg font-black tabular-nums text-pitch">{s.goals}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function SectionTitle({ icon, children, action }: { icon: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-2">
      <h2 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">{icon}{children}</h2>
      {action}
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{text}</div>;
}
