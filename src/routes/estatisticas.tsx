import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { TeamBadge } from "@/components/MatchCard";
import { listTopScorers } from "@/lib/copa.functions";

const opts = queryOptions({ queryKey: ["scorers"], queryFn: () => listTopScorers() });

export const Route = createFileRoute("/estatisticas")({
  head: () => ({ meta: [{ title: "Estatísticas — Bolão AI" }, { name: "description", content: "Artilharia e estatísticas da Copa do Mundo." }] }),
  loader: ({ context }) => { context.queryClient.ensureQueryData(opts); },
  component: Page,
});

function Page() {
  const { data } = useSuspenseQuery(opts);
  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Estatísticas</h1>
        <p className="mt-2 text-muted-foreground">Artilheiros da competição.</p>
        <div className="mt-8 rounded-xl border border-border bg-card divide-y divide-border">
          {data.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Sem gols registrados.</p>}
          {data.map((s: any, i: number) => (
            <div key={s.player_id} className="flex items-center gap-4 p-4">
              <span className={`grid h-9 w-9 place-items-center rounded-full text-sm font-bold ${i === 0 ? "bg-gold text-accent-foreground" : i < 3 ? "bg-pitch text-primary-foreground" : "bg-muted"}`}>{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold truncate">{s.name}</div>
                <TeamBadge team={{ name: s.team_name, code: s.team_code, flag_url: s.flag_url }} size="sm" />
              </div>
              <div className="text-2xl font-black tabular-nums text-pitch">{s.goals}</div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
