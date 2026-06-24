import { createFileRoute, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { TeamBadge, MatchCard, ptTeamName } from "@/components/MatchCard";
import { getTeam } from "@/lib/copa.functions";

const opts = (id: string) => queryOptions({ queryKey: ["team", id], queryFn: () => getTeam({ data: { id } }) });

const CONFED_PT: Record<string, string> = {
  UEFA: "Europa (UEFA)",
  CONMEBOL: "América do Sul (CONMEBOL)",
  CONCACAF: "América do Norte e Central (CONCACAF)",
  AFC: "Ásia (AFC)",
  CAF: "África (CAF)",
  OFC: "Oceania (OFC)",
};

const POSITION_PT: Record<string, string> = {
  GK: "Goleiro", Goalkeeper: "Goleiro",
  DF: "Zagueiro", Defender: "Zagueiro",
  MF: "Meio-campo", Midfielder: "Meio-campo",
  FW: "Atacante", Forward: "Atacante", Attacker: "Atacante",
};

export const Route = createFileRoute("/selecoes/$id")({
  loader: ({ context, params }) => { context.queryClient.ensureQueryData(opts(params.id)); },
  component: Page,
  notFoundComponent: () => <AppShell><div className="mx-auto max-w-7xl px-4 py-16 text-center"><p>Seleção não encontrada.</p></div></AppShell>,
});

function Page() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(opts(id));
  if (!data.team) throw notFound();
  const t = data.team as any;
  return (
    <AppShell>
      <div className="bg-hero text-primary-foreground">
        <div className="mx-auto max-w-7xl px-4 py-10 flex flex-wrap items-center gap-6">
          {t.flag_url && <img src={t.flag_url} alt={t.name} className="h-20 w-28 object-cover rounded-md ring-2 ring-white/30" />}
          <div className="min-w-0">
            <div className="text-sm font-semibold text-primary-foreground/80">{(t.confederation && CONFED_PT[t.confederation]) || t.confederation || ""}{t.group?.name ? ` • Grupo ${t.group.name}` : ""}</div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight">{t.name}</h1>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-primary-foreground/85">
              <span>Técnico: <span className="font-semibold text-primary-foreground">{t.coach_name ?? "—"}</span></span>
              <span>Ranking FIFA: <span className="font-semibold text-primary-foreground">{t.fifa_rank ?? "—"}</span></span>
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
              {data.matches.map((m: any) => <MatchCard key={m.id} m={m} />)}
            </div>
          )}
        </section>
        <section>
          <h2 className="text-xl font-black mb-4">Elenco</h2>
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {data.players.length === 0 && <p className="p-4 text-sm text-muted-foreground">Sem jogadores cadastrados.</p>}
            {data.players.map((p: any) => (
              <div key={p.id} className="flex items-center gap-3 p-3">
                <span className="grid h-8 w-8 place-items-center rounded-md bg-muted font-bold text-sm">{p.shirt_number ?? "?"}</span>
                <span className="flex-1 truncate font-semibold">{p.name}</span>
                <span className="text-xs text-muted-foreground">{(p.position && POSITION_PT[p.position]) || p.position || ""}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
