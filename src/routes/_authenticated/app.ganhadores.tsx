import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Trophy,
  RefreshCw,
  MessageCircle,
  Sparkles,
  Users as UsersIcon,
  Search,
  Copy,
  Download,
  DollarSign,
  Crown,
  CheckCircle2,
} from "lucide-react";
import { computarGanhadores } from "@/lib/ganhadores.functions";
import {
  listarGanhadores,
  type GanhadoresBolaoGroup,
  type GanhadorRow,
} from "@/lib/ganhadores-list.functions";
import { brl, buildWhatsAppLink, onlyDigits } from "@/lib/saas";
import { maskPhone } from "@/lib/masks";
import { ptTeamName } from "@/components/MatchCard";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/_authenticated/app/ganhadores")({
  head: () => ({ meta: [{ title: "Ganhadores" }] }),
  component: GanhadoresPage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">{error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6 text-sm">Não encontrado.</div>,
});

function GanhadoresPage() {
  const listar = useServerFn(listarGanhadores);
  const computar = useServerFn(computarGanhadores);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [q, setQ] = useState("");
  const [bolaoFilter, setBolaoFilter] = useState<string>("todos");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["ganhadores"],
    queryFn: () => listar(),
  });

  async function apurar() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await computar();
      setMsg({ kind: "ok", text: `Apuração concluída: ${res.inserted} novo(s) ganhador(es).` });
      await refetch();
      router.invalidate();
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "Erro ao apurar." });
    } finally {
      setBusy(false);
    }
  }

  const grupos = (data ?? []) as GanhadoresBolaoGroup[];

  const filteredGrupos = useMemo(() => {
    let g = grupos;
    if (bolaoFilter !== "todos") g = g.filter((x) => x.bolao_id === bolaoFilter);
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      g = g
        .map((grp) => ({
          ...grp,
          ganhadores: grp.ganhadores.filter(
            (w) =>
              w.nome.toLowerCase().includes(needle) ||
              w.whatsapp.includes(needle) ||
              String(w.codigo).includes(needle),
          ),
        }))
        .filter((grp) => grp.ganhadores.length > 0);
    }
    return g;
  }, [grupos, q, bolaoFilter]);

  const totalGanhadores = grupos.reduce((s, g) => s + g.ganhadores.length, 0);
  const totalPremio = grupos.reduce((s, g) => s + g.premio_total, 0);
  const totalTaxa = grupos.reduce((s, g) => s + g.taxa_admin, 0);

  function exportCsv() {
    const rows = [
      ["Bolão", "Protocolo", "Nome", "WhatsApp", "Jogo", "Placar", "Palpite", "Prêmio"],
    ];
    for (const g of filteredGrupos) {
      for (const w of g.ganhadores) {
        rows.push([
          g.bolao_nome,
          `BOL-${String(w.codigo).padStart(4, "0")}`,
          w.nome,
          w.whatsapp,
          `${w.home_team ?? "?"} x ${w.away_team ?? "?"}`,
          `${w.home_score ?? ""}-${w.away_score ?? ""}`,
          `${w.palpite_a}-${w.palpite_b}`,
          String(g.premio_por_ganhador),
        ]);
      }
    }
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ganhadores-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ganhadores"
        subtitle="Cruzamento entre palpites pagos, resultados oficiais e divisão do prêmio."
        icon={<Trophy className="h-5 w-5" />}
        actions={
          <>
            <button
              onClick={exportCsv}
              disabled={grupos.length === 0}
              className="inline-flex items-center gap-2 h-10 rounded-xl border border-border bg-card px-4 text-sm font-bold hover:bg-muted/40 disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> CSV
            </button>
            <button
              onClick={apurar}
              disabled={busy}
              className="inline-flex items-center gap-2 h-10 rounded-xl bg-gradient-gold px-4 font-bold text-gold-foreground shadow-gold disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
              Apurar ganhadores
            </button>
          </>
        }
      />

      {msg && (
        <div
          className={`rounded-xl border px-4 py-2 text-sm ${
            msg.kind === "ok"
              ? "border-accent/40 bg-accent/10 text-accent"
              : "border-destructive/40 bg-destructive/10 text-destructive"
          }`}
        >
          {msg.kind === "ok" ? (
            <CheckCircle2 className="inline h-4 w-4 mr-1" />
          ) : (
            <Sparkles className="inline h-4 w-4 mr-1" />
          )}
          {msg.text}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Bolões com ganhadores"
          value={String(grupos.length)}
          icon={<Trophy className="h-4 w-4" />}
          tone="gold"
        />
        <StatCard
          label="Total de ganhadores"
          value={String(totalGanhadores)}
          icon={<Crown className="h-4 w-4" />}
          tone="success"
        />
        <StatCard
          label="Prêmio total"
          value={brl(totalPremio)}
          icon={<DollarSign className="h-4 w-4" />}
          tone="success"
        />
        <StatCard
          label="Taxa admin"
          value={brl(totalTaxa)}
          icon={<DollarSign className="h-4 w-4" />}
        />
      </div>

      {/* Busca + filtro de bolão */}
      {grupos.length > 0 && (
        <div className="card-elevated rounded-2xl border border-border bg-gradient-card p-4 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome, WhatsApp ou protocolo…"
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-border bg-background/60 text-sm outline-none focus:border-accent"
            />
          </div>
          <select
            value={bolaoFilter}
            onChange={(e) => setBolaoFilter(e.target.value)}
            className="h-10 rounded-xl border border-border bg-background/60 px-3 text-sm outline-none focus:border-accent"
          >
            <option value="todos">Todos os bolões</option>
            {grupos.map((g) => (
              <option key={g.bolao_id} value={g.bolao_id}>
                {g.bolao_nome}
              </option>
            ))}
          </select>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : grupos.length === 0 ? (
        <div className="card-elevated rounded-2xl border border-border bg-gradient-card p-10 text-center">
          <UsersIcon className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-display font-bold">Nenhum ganhador apurado ainda</p>
          <p className="text-sm text-muted-foreground">
            Finalize jogos e clique em "Apurar ganhadores".
          </p>
        </div>
      ) : filteredGrupos.length === 0 ? (
        <div className="card-elevated rounded-2xl border border-border bg-gradient-card p-10 text-center text-sm text-muted-foreground">
          Nenhum ganhador encontrado para os filtros aplicados.
        </div>
      ) : (
        <div className="space-y-5">
          {filteredGrupos.map((g) => (
            <BolaoCard key={g.bolao_id} g={g} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone = "default",
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone?: "default" | "success" | "gold";
}) {
  const toneCls =
    tone === "gold"
      ? "bg-gradient-gold text-gold-foreground shadow-gold"
      : tone === "success"
        ? "bg-accent/15 text-accent border border-accent/40"
        : "bg-muted/40 text-muted-foreground border border-border";
  return (
    <div className="card-elevated rounded-2xl border border-border bg-gradient-card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={`grid place-items-center h-8 w-8 rounded-lg ${toneCls}`}>{icon}</span>
      </div>
      <p className="font-display text-2xl font-black tracking-tight">{value}</p>
    </div>
  );
}

function BolaoCard({ g }: { g: GanhadoresBolaoGroup }) {
  return (
    <section className="card-elevated rounded-2xl border border-border bg-gradient-card p-5">
      <header className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-black truncate">{g.bolao_nome}</h2>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>
              Arrecadado: <strong className="text-foreground">{brl(g.arrecadado)}</strong>
            </span>
            <span>
              Taxa ({g.percentual_admin}%):{" "}
              <strong className="text-foreground">{brl(g.taxa_admin)}</strong>
            </span>
            <span>
              Prêmio: <strong className="text-foreground">{brl(g.premio_total)}</strong>
            </span>
            <span>
              Ganhadores: <strong className="text-foreground">{g.ganhadores.length}</strong>
            </span>
          </div>
        </div>
        <div className="rounded-xl bg-gradient-gold text-gold-foreground shadow-gold px-4 py-2 text-right">
          <p className="text-[10px] uppercase tracking-wide opacity-80">Por ganhador</p>
          <p className="font-display text-lg font-black">{brl(g.premio_por_ganhador)}</p>
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

function GanhadorItem({
  w,
  premio,
  bolaoNome,
}: {
  w: GanhadorRow;
  premio: number;
  bolaoNome: string;
}) {
  const [copied, setCopied] = useState(false);
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

  async function copy() {
    try {
      await navigator.clipboard.writeText(msg);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  }

  return (
    <li className="group rounded-xl border border-border bg-background/40 p-3 transition-colors hover:bg-background/60 hover:border-accent/40">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="grid place-items-center h-10 w-10 rounded-lg bg-gradient-gold text-gold-foreground shadow-gold shrink-0">
          <Crown className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-[200px]">
          <p className="font-semibold truncate">{w.nome}</p>
          <p className="text-xs text-muted-foreground font-mono">
            {protocolo} • {w.whatsapp}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {w.home_team}{" "}
            <span className="font-bold text-foreground">
              {w.home_score}x{w.away_score}
            </span>{" "}
            {w.away_team}
            {" · palpite "}
            <span className="font-bold text-primary">
              {w.palpite_a}x{w.palpite_b}
            </span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase text-muted-foreground">Prêmio</p>
          <p className="font-display font-black text-accent">{brl(premio)}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copy}
            className="inline-flex items-center gap-1 h-9 rounded-lg border border-border bg-card px-3 text-xs font-bold hover:bg-muted/40"
            title="Copiar mensagem"
          >
            {copied ? (
              <CheckCircle2 className="h-4 w-4 text-accent" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {copied ? "Copiado" : "Copiar"}
          </button>
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 h-9 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground hover:opacity-90"
          >
            <MessageCircle className="h-4 w-4" /> Parabenizar
          </a>
        </div>
      </div>
    </li>
  );
}
