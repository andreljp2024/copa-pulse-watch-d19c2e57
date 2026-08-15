import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { MatchCard, TeamLite } from "@/components/MatchCard";
import { Trophy } from "lucide-react";
import { listKnockoutMatches } from "@/lib/copa.functions";

const opts = queryOptions({ queryKey: ["knockoutMatches"], queryFn: () => listKnockoutMatches() });

export const Route = createFileRoute("/mata-mata")({
  head: () => ({
    meta: [
      { title: "Mata-mata — Bolão AI" },
      { name: "description", content: "Chaveamento do mata-mata da Copa do Mundo 2026." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(opts),
  component: Page,
});

type Match = {
  id: string;
  kickoff_at: string;
  status: string;
  home_score: number;
  away_score: number;
  home: TeamLite | null;
  away: TeamLite | null;
  stadium?: { name: string; city?: string | null } | null;
  phase: "round_of_32" | "round_of_16" | "quarter" | "semi" | "third_place" | "final";
};

const phaseOrder: Record<string, number> = {
  round_of_32: 0,
  round_of_16: 1,
  quarter: 2,
  semi: 3,
  third_place: 4,
  final: 5,
};

const roundNames: Record<string, string> = {
  round_of_32: "Segundas de final (32 avos)",
  round_of_16: "Oitavas de final",
  quarter: "Quartas de final",
  semi: "Semifinais",
  third_place: "3º lugar",
  final: "Final",
};

function Page() {
  const { data: matches } = useSuspenseQuery(opts);

  const matchesByPhase = matches.reduce(
    (acc, match) => {
      const p = match.phase;
      if (!acc[p]) acc[p] = [];
      acc[p].push(match as unknown as Match);
      return acc;
    },
    {} as Record<string, Match[]>,
  );

  const sortedPhases = Object.keys(phaseOrder).filter((p) => matchesByPhase[p] || getPhaseSlots(p) > 0);
  sortedPhases.sort((a, b) => phaseOrder[a] - phaseOrder[b]);

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-10">
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Mata-mata</h1>
        <p className="mt-2 text-muted-foreground">
          Chaveamento da fase eliminatória — Copa do Mundo 2026 (48 seleções).
        </p>
        <div className="mt-8 overflow-x-auto">
          <div className="flex gap-6 min-w-[800px]">
            {sortedPhases.map((phase) => (
              <div key={phase} className="flex-1 flex flex-col justify-around gap-4 min-w-[200px]">
                <div className="text-xs font-black uppercase text-pitch text-center">
                  {roundNames[phase] || phase}
                </div>
                {(matchesByPhase[phase] || []).map((m) => (
                  <div key={m.id} className="min-w-[200px]">
                    <MatchCard m={m} />
                  </div>
                ))}
                {Array.from({
                  length: Math.max(0, getPhaseSlots(phase) - (matchesByPhase[phase] || []).length),
                }).map((_, i) => (
                  <div
                    key={`placeholder-${phase}-${i}`}
                    className="rounded-lg border border-dashed border-border bg-card/60 p-3 text-xs text-muted-foreground text-center"
                  >
                    <div className="font-semibold">A definir</div>
                    <div className="my-2 h-px bg-border" />
                    <div className="font-semibold">A definir</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-8 inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Trophy className="h-4 w-4 text-gold" /> Os confrontos são gerados quando as partidas de
          grupo forem finalizadas.
        </div>
      </div>
    </AppShell>
  );
}

function getPhaseSlots(phase: string): number {
  switch (phase) {
    case "round_of_32":
      return 16;
    case "round_of_16":
      return 8;
    case "quarter":
      return 4;
    case "semi":
      return 2;
    case "third_place":
      return 1;
    case "final":
      return 1;
    default:
      return 0;
  }
}