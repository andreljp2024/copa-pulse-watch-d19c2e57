import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Trophy } from "lucide-react";

export const Route = createFileRoute("/mata-mata")({
  head: () => ({ meta: [{ title: "Mata-mata — CopaHub" }, { name: "description", content: "Chaveamento do mata-mata da Copa do Mundo." }] }),
  component: Page,
});

const rounds = [
  { name: "Oitavas", slots: 8 },
  { name: "Quartas", slots: 4 },
  { name: "Semifinal", slots: 2 },
  { name: "Final", slots: 1 },
];

function Page() {
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-10">
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Mata-mata</h1>
        <p className="mt-2 text-muted-foreground">Chaveamento da fase eliminatória. Será preenchido automaticamente após a fase de grupos.</p>
        <div className="mt-8 overflow-x-auto">
          <div className="flex gap-6 min-w-[800px]">
            {rounds.map((r) => (
              <div key={r.name} className="flex-1 flex flex-col justify-around gap-4">
                <div className="text-xs font-black uppercase text-pitch text-center">{r.name}</div>
                {Array.from({ length: r.slots }).map((_, i) => (
                  <div key={i} className="rounded-lg border border-dashed border-border bg-card/60 p-3 text-xs text-muted-foreground text-center">
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
          <Trophy className="h-4 w-4 text-gold" /> Os confrontos são gerados quando as partidas de grupo forem finalizadas.
        </div>
      </div>
    </AppShell>
  );
}
