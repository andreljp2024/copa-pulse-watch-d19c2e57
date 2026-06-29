import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { TeamBadge } from "@/components/MatchCard";
import { listTeams } from "@/lib/copa.functions";

const opts = queryOptions({ queryKey: ["teams"], queryFn: () => listTeams() });

export const Route = createFileRoute("/selecoes")({
  head: () => ({
    meta: [
      { title: "Seleções — Bolão AI" },
      { name: "description", content: "Todas as seleções da Copa do Mundo." },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(opts);
  },
  component: Page,
});

const GRUPOS = ["Todos", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

function Page() {
  const { data } = useSuspenseQuery(opts);
  const [grupo, setGrupo] = useState("Todos");
  const [busca, setBusca] = useState("");

  const filtered = useMemo(() => {
    return data.filter((t: any) => {
      if (t.code === "TBD") return false;
      if (grupo !== "Todos" && t.group?.name !== grupo) return false;
      if (busca && !t.name.toLowerCase().includes(busca.toLowerCase())) return false;
      return true;
    });
  }, [data, grupo, busca]);

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-10">
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Seleções</h1>
        <p className="mt-2 text-muted-foreground">
          {filtered.length} de {data.filter((t: any) => t.code !== "TBD").length} seleções
        </p>

        <div className="mt-6 flex flex-wrap gap-3 items-center">
          <div className="flex gap-1 rounded-lg border border-border bg-card p-1 overflow-x-auto">
            {GRUPOS.map((g) => (
              <button
                key={g}
                onClick={() => setGrupo(g)}
                className={`px-3 py-1.5 rounded-md text-sm font-semibold whitespace-nowrap ${grupo === g ? "bg-pitch text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {g === "Todos" ? "Todos" : `Grupo ${g}`}
              </button>
            ))}
          </div>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar seleção…"
            className="h-10 flex-1 min-w-[150px] rounded-lg border border-border bg-card px-3 text-sm"
          />
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((t: any) => (
            <Link
              key={t.id}
              to="/selecoes/$id"
              params={{ id: t.id }}
              className="group rounded-xl border border-border bg-card p-4 card-elevated hover:border-pitch/40 transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <TeamBadge team={t} size="lg" />
                {t.group?.name && (
                  <span className="px-2 py-0.5 rounded-md bg-muted text-xs font-bold">
                    Grupo {t.group.name}
                  </span>
                )}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>
                  <span className="block text-[10px] uppercase">Técnico</span>
                  <span className="text-foreground font-semibold truncate block">
                    {t.coach_name ?? "—"}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase">Ranking FIFA</span>
                  <span className="text-foreground font-semibold">{t.fifa_rank ?? "—"}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
        {filtered.length === 0 && (
          <p className="mt-12 text-center text-sm text-muted-foreground">
            Nenhuma seleção encontrada.
          </p>
        )}
      </div>
    </AppShell>
  );
}
