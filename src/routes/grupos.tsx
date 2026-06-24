import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { StandingsTable } from "@/components/StandingsTable";
import { listGroups } from "@/lib/copa.functions";

const opts = queryOptions({ queryKey: ["groups"], queryFn: () => listGroups() });

export const Route = createFileRoute("/grupos")({
  head: () => ({ meta: [{ title: "Grupos — BolaoAI" }, { name: "description", content: "Classificação atualizada de todos os grupos da Copa do Mundo." }] }),
  loader: ({ context }) => { context.queryClient.ensureQueryData(opts); },
  component: Page,
});

function Page() {
  const { data } = useSuspenseQuery(opts);
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-10">
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Grupos & Classificação</h1>
        <p className="mt-2 text-muted-foreground">Tabela calculada automaticamente a partir dos resultados.</p>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {data.groups.map((g: any) => {
            const rows = data.standings.filter((r: any) => r.group_id === g.id);
            return (
              <div key={g.id} className="rounded-xl border border-border bg-card p-4 card-elevated">
                <h2 className="text-lg font-black text-pitch mb-2">Grupo {g.name}</h2>
                {rows.length ? <StandingsTable rows={rows as any} /> : <p className="text-sm text-muted-foreground py-6 text-center">Sem seleções neste grupo.</p>}
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
