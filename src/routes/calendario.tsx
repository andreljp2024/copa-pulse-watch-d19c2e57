import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { MatchCard } from "@/components/MatchCard";
import { listMatches } from "@/lib/copa.functions";
import { SITE, ogMeta, canonicalMeta, jsonLd } from "@/lib/seo";

const opts = queryOptions({ queryKey: ["matches"], queryFn: () => listMatches() });

export const Route = createFileRoute("/calendario")({
  head: () => ({
    meta: [
      { title: "Calendário — Bolão AI" },
      {
        name: "description",
        content: "Todas as partidas da Copa com filtros por status, grupo e fase.",
      },
      ...ogMeta({
        title: "Calendário — Bolão AI",
        description: "Todas as partidas da Copa com filtros por status, grupo e fase.",
        url: "/calendario",
      }),
      canonicalMeta("/calendario"),
    ],
    scripts: [
      jsonLd({
        "@context": "https://schema.org",
        "@type": "SportsTournament",
        name: "Copa do Mundo 2026",
        url: `${SITE.domain}/calendario`,
        inLanguage: "pt-BR",
        eventStatus: "https://schema.org/EventScheduled",
      }),
      jsonLd({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Início", item: SITE.domain },
          {
            "@type": "ListItem",
            position: 2,
            name: "Calendário",
            item: `${SITE.domain}/calendario`,
          },
        ],
      }),
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(opts);
  },
  component: Page,
});

const STATUS = [
  { v: "all", l: "Todos" },
  { v: "live", l: "Ao vivo" },
  { v: "scheduled", l: "Agendados" },
  { v: "finished", l: "Encerrados" },
];

function Page() {
  const { data } = useSuspenseQuery(opts);
  const [status, setStatus] = useState("all");
  const [phase, setPhase] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return data.filter((m: any) => {
      if (status !== "all" && m.status !== status) return false;
      if (phase !== "all" && m.phase !== phase) return false;
      if (search) {
        const s = search.toLowerCase();
        if (
          !m.home?.name?.toLowerCase().includes(s) &&
          !m.away?.name?.toLowerCase().includes(s) &&
          !m.stadium?.name?.toLowerCase().includes(s)
        )
          return false;
      }
      return true;
    });
  }, [data, status, phase, search]);

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-10">
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Calendário de Jogos</h1>
        <p className="mt-2 text-muted-foreground">
          {filtered.length} de {data.length} partidas
        </p>

        <div className="mt-6 flex flex-wrap gap-3 items-center">
          <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
            {STATUS.map((s) => (
              <button
                key={s.v}
                onClick={() => setStatus(s.v)}
                className={`px-3 py-1.5 rounded-md text-sm font-semibold ${status === s.v ? "bg-pitch text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {s.l}
              </button>
            ))}
          </div>
          <select
            value={phase}
            onChange={(e) => setPhase(e.target.value)}
            className="h-10 rounded-lg border border-border bg-card px-3 text-sm"
          >
            <option value="all">Todas as fases</option>
            <option value="group">Fase de grupos</option>
            <option value="round_of_32">32 avos de final</option>
            <option value="round_of_16">Oitavas de final</option>
            <option value="quarter">Quartas de final</option>
            <option value="semi">Semifinais</option>
            <option value="third_place">3º lugar</option>
            <option value="final">Final</option>
          </select>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar seleção ou estádio…"
            className="h-10 flex-1 min-w-[180px] rounded-lg border border-border bg-card px-3 text-sm"
          />
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((m: any) => (
            <MatchCard key={m.id} m={m} />
          ))}
        </div>
        {filtered.length === 0 && (
          <p className="mt-12 text-center text-sm text-muted-foreground">
            Nenhuma partida encontrada.
          </p>
        )}
      </div>
    </AppShell>
  );
}
