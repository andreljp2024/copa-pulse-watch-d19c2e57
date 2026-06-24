import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Trophy, RefreshCw, MessageCircle, Sparkles, Users as UsersIcon } from "lucide-react";
import { computarGanhadores } from "@/lib/ganhadores.functions";
import { listarGanhadores, type GanhadoresBolaoGroup, type GanhadorRow } from "@/lib/ganhadores-list.functions";
import { brl, buildWhatsAppLink } from "@/lib/saas";
import { PageHeader } from "@/components/PageHeader";


export const Route = createFileRoute("/_authenticated/app/ganhadores")({
  head: () => ({ meta: [{ title: "Ganhadores" }] }),
  component: GanhadoresPage,
  errorComponent: ({ error }) => <div className="p-6 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-6 text-sm">Não encontrado.</div>,
});

function GanhadoresPage() {
  const listar = useServerFn(listarGanhadores);
  const computar = useServerFn(computarGanhadores);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["ganhadores"],
    queryFn: () => listar(),
  });

  async function apurar() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await computar();
      setMsg(`Apuração concluída: ${res.inserted} novo(s) ganhador(es).`);
      await refetch();
      router.invalidate();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro ao apurar.");
    } finally {
      setBusy(false);
    }
  }

  const grupos = (data ?? []) as GanhadoresBolaoGroup[];
  const totalGanhadores = grupos.reduce((s, g) => s + g.ganhadores.length, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ganhadores"
        subtitle="Cruzamento entre palpites pagos, resultados oficiais e divisão do prêmio."
        icon={<Trophy className="h-5 w-5" />}
        actions={
          <button
            onClick={apurar}
            disabled={busy}
            className="inline-flex items-center gap-2 h-10 rounded-xl bg-gradient-gold px-4 font-bold text-gold-foreground shadow-gold disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
            Apurar ganhadores
          </button>
        }
      />


      {msg && (
        <div className="rounded-xl border border-accent/40 bg-card/60 px-4 py-2 text-sm">
          <Sparkles className="inline h-4 w-4 text-accent mr-1" /> {msg}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : grupos.length === 0 ? (
        <div className="rounded-2xl border border-border bg-gradient-card p-10 text-center">
          <UsersIcon className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-display font-bold">Nenhum ganhador apurado ainda</p>
          <p className="text-sm text-muted-foreground">Finalize jogos e clique em "Apurar ganhadores".</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPI label="Bolões com ganhadores" value={String(grupos.length)} />
            <KPI label="Total de ganhadores" value={String(totalGanhadores)} />
            <KPI label="Prêmio total" value={brl(grupos.reduce((s, g) => s + g.premio_total, 0))} />
            <KPI label="Taxa admin" value={brl(grupos.reduce((s, g) => s + g.taxa_admin, 0))} />
          </div>

          {grupos.map((g) => (
            <BolaoCard key={g.bolao_id} g={g} />
          ))}
        </div>
      )}
    </div>
  );
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-gradient-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-display text-xl font-black mt-1">{value}</p>
    </div>
  );
}

function BolaoCard({ g }: { g: GanhadoresBolaoGroup }) {
  return (
    <section className="rounded-2xl border border-border bg-gradient-card p-5 card-elevated">
      <header className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <h2 className="font-display text-xl font-black">{g.bolao_nome}</h2>
          <p className="text-xs text-muted-foreground">
            Arrecadado: <strong>{brl(g.arrecadado)}</strong> • Taxa admin ({g.percentual_admin}%):{" "}
            <strong>{brl(g.taxa_admin)}</strong> • Prêmio: <strong>{brl(g.premio_total)}</strong>
          </p>
        </div>
        <div className="rounded-xl bg-accent/15 border border-accent/40 px-3 py-2 text-right">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Por ganhador</p>
          <p className="font-display text-lg font-black text-accent">{brl(g.premio_por_ganhador)}</p>
        </div>
      </header>

      <ul className="space-y-2">
        {g.ganhadores.map((w) => (
          <GanhadorItem key={w.id} w={w} premio={g.premio_por_ganhador} bolaoNome={g.bolao_nome} />
        ))}
      </ul>
    </section>
  );
}

function GanhadorItem({ w, premio, bolaoNome }: { w: GanhadorRow; premio: number; bolaoNome: string }) {
  const protocolo = `BOL-${String(w.codigo).padStart(4, "0")}`;
  const msg =
    `🏆 *Parabéns, ${w.nome}!*\n\n` +
    `Você é um dos ganhadores do bolão *${bolaoNome}*!\n\n` +
    `Jogo: ${w.home_team ?? "?"} ${w.home_score ?? "?"} x ${w.away_score ?? "?"} ${w.away_team ?? "?"}\n` +
    `Seu palpite: ${w.palpite_a} x ${w.palpite_b} ✅\n` +
    `Protocolo: ${protocolo}\n\n` +
    `💰 Valor do prêmio: *${brl(premio)}*\n\n` +
    `Em breve entraremos em contato para o pagamento. Obrigado por participar! 💚💛`;
  const link = buildWhatsAppLink(w.whatsapp, msg);

  return (
    <li className="flex items-center gap-3 rounded-xl border border-border bg-background/40 p-3 flex-wrap">
      <div className="flex-1 min-w-[180px]">
        <p className="font-semibold">{w.nome}</p>
        <p className="text-xs text-muted-foreground font-mono">
          {protocolo} • {w.whatsapp}
        </p>
        <p className="text-xs text-muted-foreground">
          {w.home_team} <span className="font-bold text-foreground">{w.home_score}x{w.away_score}</span> {w.away_team}
          {" · "}palpite <span className="font-bold text-primary">{w.palpite_a}x{w.palpite_b}</span>
        </p>
      </div>
      <div className="text-right">
        <p className="text-[10px] uppercase text-muted-foreground">Prêmio</p>
        <p className="font-display font-black text-accent">{brl(premio)}</p>
      </div>
      <a
        href={link}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 h-9 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground hover:opacity-90"
      >
        <MessageCircle className="h-4 w-4" /> Parabenizar
      </a>
    </li>
  );
}
