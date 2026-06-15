import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { TeamBadge } from "@/components/MatchCard";
import { listTeams } from "@/lib/copa.functions";

const opts = queryOptions({ queryKey: ["teams"], queryFn: () => listTeams() });

export const Route = createFileRoute("/selecoes")({
  head: () => ({ meta: [{ title: "Seleções — CopaHub" }, { name: "description", content: "Todas as seleções da Copa do Mundo." }] }),
  loader: ({ context }) => { context.queryClient.ensureQueryData(opts); },
  component: Page,
});

function Page() {
  const { data } = useSuspenseQuery(opts);
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-10">
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Seleções</h1>
        <p className="mt-2 text-muted-foreground">{data.length} seleções participantes</p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.map((t: any) => (
            <Link key={t.id} to="/selecoes/$id" params={{ id: t.id }} className="group rounded-xl border border-border bg-card p-4 card-elevated hover:border-pitch/40 transition-colors">
              <div className="flex items-center justify-between gap-3">
                <TeamBadge team={t} size="lg" />
                {t.group?.name && <span className="px-2 py-0.5 rounded-md bg-muted text-xs font-bold">Grupo {t.group.name}</span>}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div><span className="block text-[10px] uppercase">Técnico</span><span className="text-foreground font-semibold truncate block">{t.coach_name ?? "—"}</span></div>
                <div><span className="block text-[10px] uppercase">Ranking FIFA</span><span className="text-foreground font-semibold">{t.fifa_rank ?? "—"}</span></div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
