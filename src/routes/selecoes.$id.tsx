import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { TeamBadge, MatchCard, ptTeamName } from "@/components/MatchCard";
import { StandingsTable } from "@/components/StandingsTable";
import { getTeam } from "@/lib/copa.functions";

const opts = (id: string) =>
  queryOptions({ queryKey: ["team", id], queryFn: () => getTeam({ data: { id } }) });

const CONFED_PT: Record<string, string> = {
  UEFA: "Europa (UEFA)",
  CONMEBOL: "América do Sul (CONMEBOL)",
  CONCACAF: "América do Norte e Central (CONCACAF)",
  AFC: "Ásia (AFC)",
  CAF: "África (CAF)",
  OFC: "Oceania (OFC)",
};

export const Route = createFileRoute("/selecoes/$id")({
  loader: ({ context, params }) => {
    context.queryClient.ensureQueryData(opts(params.id));
  },
  component: Page,
  notFoundComponent: () => (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-16 text-center">
        <p>Seleção não encontrada.</p>
      </div>
    </AppShell>
  ),
});

function Page() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(opts(id));
  if (!data.team) throw notFound();
  const t = data.team as any;

  const stats = useMemo(() => {
    const fin = data.matches.filter((m: any) => m.status === "finished");
    let v = 0,
      e = 0,
      d = 0,
      gp = 0,
      gc = 0;
    for (const m of fin) {
      const isHome = m.home_team_id === id;
      gp += isHome ? (m.home_score ?? 0) : (m.away_score ?? 0);
      gc += isHome ? (m.away_score ?? 0) : (m.home_score ?? 0);
      const dif =
        (isHome ? (m.home_score ?? 0) : (m.away_score ?? 0)) -
        (isHome ? (m.away_score ?? 0) : (m.home_score ?? 0));
      if (dif > 0) v++;
      else if (dif === 0) e++;
      else d++;
    }
    return {
      v,
      e,
      d,
      gp,
      gc,
      j: fin.length,
      aproveitamento: fin.length ? Math.round(((v * 3 + e) / (fin.length * 3)) * 100) : 0,
    };
  }, [data.matches, id]);

  return (
    <AppShell>
      <div className="bg-hero text-primary-foreground">
        <div className="mx-auto max-w-7xl px-4 py-10 flex flex-wrap items-center gap-6">
          {t.flag_url && (
            <img
              src={t.flag_url}
              alt={ptTeamName(t.name)}
              className="h-20 w-28 object-cover rounded-md ring-2 ring-white/30"
            />
          )}
          <div className="min-w-0">
            <div className="text-sm font-semibold text-primary-foreground/80">
              {(t.confederation && CONFED_PT[t.confederation]) || t.confederation || ""}
              {t.group?.name ? ` • Grupo ${t.group.name}` : ""}
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight">{ptTeamName(t.name)}</h1>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-primary-foreground/85">
              <span>
                Técnico:{" "}
                <span className="font-semibold text-primary-foreground">{t.coach_name ?? "—"}</span>
              </span>
              <span>
                Ranking FIFA:{" "}
                <span className="font-semibold text-primary-foreground">{t.fifa_rank ?? "—"}</span>
              </span>
              {stats.j > 0 && (
                <span>
                  Aproveitamento:{" "}
                  <span className="font-semibold text-primary-foreground">
                    {stats.aproveitamento}%
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-10 grid gap-8 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <h2 className="text-xl font-black mb-4">Partidas</h2>
          {data.matches.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem partidas cadastradas.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {data.matches.map((m: any) => (
                <MatchCard key={m.id} m={m} />
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-8">
          {t.group?.name && (
            <section>
              <h2 className="text-xl font-black mb-4">Grupo {t.group.name}</h2>
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <StandingsTable rows={(data as { groupStandings?: unknown[] }).groupStandings as never[] ?? []} />
              </div>
            </section>
          )}

          <section>
            <h2 className="text-xl font-black mb-4">Estatísticas</h2>
            <div className="rounded-xl border border-border bg-card divide-y divide-border">
              <div className="flex items-center justify-between p-4">
                <span className="text-sm text-muted-foreground">Jogos</span>
                <span className="text-lg font-black">{stats.j}</span>
              </div>
              <div className="flex items-center justify-between p-4">
                <span className="text-sm text-muted-foreground">Vitórias</span>
                <span className="text-lg font-black text-green-600">{stats.v}</span>
              </div>
              <div className="flex items-center justify-between p-4">
                <span className="text-sm text-muted-foreground">Empates</span>
                <span className="text-lg font-black text-yellow-600">{stats.e}</span>
              </div>
              <div className="flex items-center justify-between p-4">
                <span className="text-sm text-muted-foreground">Derrotas</span>
                <span className="text-lg font-black text-red-600">{stats.d}</span>
              </div>
              <div className="flex items-center justify-between p-4">
                <span className="text-sm text-muted-foreground">Gols Pró</span>
                <span className="text-lg font-black">{stats.gp}</span>
              </div>
              <div className="flex items-center justify-between p-4">
                <span className="text-sm text-muted-foreground">Gols Contra</span>
                <span className="text-lg font-black">{stats.gc}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-pitch/5">
                <span className="text-sm font-bold">Aproveitamento</span>
                <span className="text-lg font-black">{stats.aproveitamento}%</span>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
