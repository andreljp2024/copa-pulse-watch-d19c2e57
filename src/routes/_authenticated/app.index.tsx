import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { brl, publicBolaoUrl } from "@/lib/saas";
import { computarGanhadores } from "@/lib/ganhadores.functions";
import { Users, ListChecks, CheckCircle2, Clock, DollarSign, Trophy, Copy, ExternalLink, Sparkles, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/")({
  component: Dashboard,
});

type Stats = {
  torcedores: number;
  palpites: number;
  pagos: number;
  pendentes: number;
  arrecadado: number;
  ganhadores: number;
  bolao: { id: string; nome: string; slug: string; valor_palpite: number } | null;
  serie: { dia: string; total: number }[];
};

function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [copied, setCopied] = useState(false);
  const [computing, setComputing] = useState(false);
  const compute = useServerFn(computarGanhadores);

  async function runCompute() {
    setComputing(true);
    try {
      const r = await compute();
      alert(`Ganhadores: ${r.inserted} novos (de ${r.total_candidates} candidatos).`);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao computar ganhadores");
    } finally {
      setComputing(false);
    }
  }



  useEffect(() => { void load(); }, []);

  async function load() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data: t } = await supabase.from("tenants").select("id").eq("owner_user_id", u.user.id).maybeSingle();
    if (!t) return;
    const { data: bo } = await supabase.from("boloes").select("id, nome, slug, valor_palpite").eq("tenant_id", t.id).order("created_at", { ascending: true }).limit(1).maybeSingle();
    const [tor, pal, gan, serieRows] = await Promise.all([
      supabase.from("torcedores").select("id", { count: "exact", head: true }).eq("tenant_id", t.id),
      supabase.from("palpites").select("status_pagamento, valor", { count: "exact" }).eq("tenant_id", t.id),
      supabase.from("ganhadores").select("id", { count: "exact", head: true }).eq("tenant_id", t.id),
      supabase.from("palpites").select("created_at").eq("tenant_id", t.id).gte("created_at", new Date(Date.now() - 13 * 86400000).toISOString()),
    ]);
    const palpites = pal.data ?? [];
    const pagos = palpites.filter((p) => p.status_pagamento === "pago").length;
    const arrecadado = palpites.filter((p) => p.status_pagamento === "pago").reduce((s, p) => s + Number(p.valor ?? 0), 0);
    const buckets = new Map<string, number>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      buckets.set(d, 0);
    }
    for (const r of serieRows.data ?? []) {
      const d = String(r.created_at).slice(0, 10);
      if (buckets.has(d)) buckets.set(d, (buckets.get(d) ?? 0) + 1);
    }
    setStats({
      torcedores: tor.count ?? 0,
      palpites: pal.count ?? 0,
      pagos,
      pendentes: (pal.count ?? 0) - pagos,
      arrecadado,
      ganhadores: gan.count ?? 0,
      bolao: bo ? { id: bo.id, nome: bo.nome, slug: bo.slug, valor_palpite: Number(bo.valor_palpite) } : null,
      serie: [...buckets.entries()].map(([dia, total]) => ({ dia, total })),
    });
  }

  async function copyLink() {
    if (!stats?.bolao) return;
    await navigator.clipboard.writeText(publicBolaoUrl(stats.bolao.slug));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!stats) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  const cards = [
    { label: "Torcedores", value: stats.torcedores, icon: Users },
    { label: "Palpites totais", value: stats.palpites, icon: ListChecks },
    { label: "Palpites pagos", value: stats.pagos, icon: CheckCircle2 },
    { label: "Pendentes", value: stats.pendentes, icon: Clock },
    { label: "Arrecadado", value: brl(stats.arrecadado), icon: DollarSign },
    { label: "Ganhadores", value: stats.ganhadores, icon: Trophy },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Dashboard</h1>
          {stats.bolao && <p className="text-sm text-muted-foreground">Bolão ativo: <strong>{stats.bolao.nome}</strong></p>}
        </div>
        <button
          onClick={runCompute}
          disabled={computing}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-pitch px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {computing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Computar ganhadores
        </button>
      </div>

      {stats.bolao && (
        <div className="rounded-2xl border border-pitch/30 bg-pitch/5 p-5">
          <p className="text-xs uppercase tracking-wide font-semibold text-pitch">Link público do bolão</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="text-sm bg-background border border-border rounded-lg px-3 py-2 break-all">{publicBolaoUrl(stats.bolao.slug)}</code>
            <button onClick={copyLink} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-pitch px-3 text-sm font-semibold text-primary-foreground">
              <Copy className="h-4 w-4" /> {copied ? "Copiado!" : "Copiar"}
            </button>
            <Link to="/bolao/$slug" params={{ slug: stats.bolao.slug }} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-semibold">
              <ExternalLink className="h-4 w-4" /> Abrir
            </Link>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{label}</span>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-3xl font-black">{value}</p>
          </div>
        ))}
      </div>

      <Sparkline serie={stats.serie} />
    </div>
  );
}

function Sparkline({ serie }: { serie: { dia: string; total: number }[] }) {
  const max = Math.max(1, ...serie.map((s) => s.total));
  const w = 600;
  const h = 140;
  const pad = 24;
  const bw = (w - pad * 2) / serie.length;
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-bold mb-3">Palpites nos últimos 14 dias</h2>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-40">
        {serie.map((s, i) => {
          const bh = ((h - pad * 2) * s.total) / max;
          return (
            <g key={s.dia}>
              <rect x={pad + i * bw + 2} y={h - pad - bh} width={bw - 4} height={bh} rx={3} className="fill-pitch/80" />
              <text x={pad + i * bw + bw / 2} y={h - 6} textAnchor="middle" className="fill-muted-foreground" fontSize="9">
                {s.dia.slice(5)}
              </text>
              {s.total > 0 && (
                <text x={pad + i * bw + bw / 2} y={h - pad - bh - 4} textAnchor="middle" className="fill-foreground" fontSize="10" fontWeight="700">
                  {s.total}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
