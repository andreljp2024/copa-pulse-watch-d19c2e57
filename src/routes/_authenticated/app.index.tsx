import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { brl, publicBolaoUrl } from "@/lib/saas";
import { computarGanhadores } from "@/lib/ganhadores.functions";
import { formatBR } from "@/lib/timezone";
import {
  Users,
  ListChecks,
  CheckCircle2,
  Clock,
  DollarSign,
  Trophy,
  Copy,
  ExternalLink,
  Sparkles,
  Loader2,
  RefreshCw,
} from "lucide-react";

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
  taxa_admin: number;
  premio_torcedores: number;
  bolao: {
    id: string;
    nome: string;
    slug: string;
    valor_palpite: number;
    percentual_admin: number;
  } | null;
  serie: { dia: string; total: number }[];
};

function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [computing, setComputing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const compute = useServerFn(computarGanhadores);

  const load = useCallback(async () => {
    try {
      setError(null);
      const { data: u, error: uerr } = await supabase.auth.getUser();
      if (uerr) throw uerr;
      if (!u.user) return;
      const { data: t, error: terr } = await supabase
        .from("tenants")
        .select("id")
        .eq("owner_user_id", u.user.id)
        .maybeSingle();
      if (terr) throw terr;
      if (!t?.id) {
        setStats({
          torcedores: 0,
          palpites: 0,
          pagos: 0,
          pendentes: 0,
          arrecadado: 0,
          ganhadores: 0,
          taxa_admin: 0,
          premio_torcedores: 0,
          bolao: null,
          serie: [],
        });
        return;
      }
      const { data: bo } = await supabase
        .from("boloes")
        .select("id, nome, slug, valor_palpite, percentual_admin")
        .eq("tenant_id", t.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      const desde14 = new Date(Date.now() - 13 * 86400000).toISOString();
      const [torCount, palTotal, palPagos, valoresPagos, ganCount, serieRows] =
        await Promise.all([
          supabase
            .from("torcedores")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", t.id),
          supabase
            .from("palpites")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", t.id),
          supabase
            .from("palpites")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", t.id)
            .eq("status_pagamento", "pago"),
          supabase
            .from("palpites")
            .select("valor")
            .eq("tenant_id", t.id)
            .eq("status_pagamento", "pago")
            .limit(10000),
          supabase
            .from("ganhadores")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", t.id),
          supabase
            .from("palpites")
            .select("created_at")
            .eq("tenant_id", t.id)
            .gte("created_at", desde14)
            .limit(10000),
        ]);

      const total = palTotal.count ?? 0;
      const pagos = palPagos.count ?? 0;
      const arrecadado = (valoresPagos.data ?? []).reduce(
        (s, p) => s + Number(p.valor ?? 0),
        0,
      );
      const pct = Number((bo as { percentual_admin?: number } | null)?.percentual_admin ?? 30);
      const taxa_admin = arrecadado * (pct / 100);
      const premio_torcedores = arrecadado - taxa_admin;

      const buckets = new Map<string, number>();
      for (let i = 13; i >= 0; i--) {
        const d = formatBR(new Date(Date.now() - i * 86400000), "yyyy-MM-dd");
        buckets.set(d, 0);
      }
      for (const r of serieRows.data ?? []) {
        const d = formatBR(new Date(r.created_at as string), "yyyy-MM-dd");
        if (buckets.has(d)) buckets.set(d, (buckets.get(d) ?? 0) + 1);
      }

      setStats({
        torcedores: torCount.count ?? 0,
        palpites: total,
        pagos,
        pendentes: Math.max(0, total - pagos),
        arrecadado,
        ganhadores: ganCount.count ?? 0,
        taxa_admin,
        premio_torcedores,
        bolao: bo
          ? {
              id: bo.id,
              nome: bo.nome,
              slug: bo.slug,
              valor_palpite: Number(bo.valor_palpite),
              percentual_admin: pct,
            }
          : null,
        serie: [...buckets.entries()].map(([dia, total]) => ({ dia, total })),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar painel");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function runCompute() {
    setComputing(true);
    try {
      const r = await compute();
      toast.success(
        `Ganhadores apurados: ${r.inserted} novos (de ${r.total_candidates} candidatos).`,
      );
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao computar ganhadores");
    } finally {
      setComputing(false);
    }
  }

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function copyLink() {
    if (!stats?.bolao) return;
    try {
      await navigator.clipboard.writeText(publicBolaoUrl(stats.bolao.slug));
      setCopied(true);
      toast.success("Link copiado");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  if (loading && !stats) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-40 rounded-lg bg-muted animate-pulse" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl border border-border bg-card animate-pulse" />
          ))}
        </div>
        <div className="h-48 rounded-2xl border border-border bg-card animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5">
        <p className="text-sm font-semibold text-destructive">Falha ao carregar painel</p>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        <button
          onClick={refresh}
          className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold"
        >
          <RefreshCw className="h-4 w-4" /> Tentar novamente
        </button>
      </div>
    );
  }

  if (!stats) return null;

  const cards = [
    { label: "Torcedores", value: stats.torcedores, icon: Users },
    { label: "Palpites totais", value: stats.palpites, icon: ListChecks },
    { label: "Palpites pagos", value: stats.pagos, icon: CheckCircle2 },
    { label: "Pendentes", value: stats.pendentes, icon: Clock },
    { label: "Arrecadado", value: brl(stats.arrecadado), icon: DollarSign },
    {
      label: `Taxa admin (${stats.bolao?.percentual_admin ?? 30}%)`,
      value: brl(stats.taxa_admin),
      icon: DollarSign,
    },
    { label: "Prêmio aos torcedores", value: brl(stats.premio_torcedores), icon: Trophy },
    { label: "Ganhadores", value: stats.ganhadores, icon: Trophy },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Painel</h1>
          {stats.bolao ? (
            <p className="text-sm text-muted-foreground">
              Bolão ativo: <strong>{stats.bolao.nome}</strong>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhum bolão criado ainda.{" "}
              <Link to="/app/bolao" className="font-semibold text-pitch underline">
                Criar bolão
              </Link>
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold disabled:opacity-60"
            aria-label="Atualizar painel"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar
          </button>
          <button
            onClick={runCompute}
            disabled={computing}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-pitch px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {computing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Computar ganhadores
          </button>
        </div>
      </div>

      {stats.bolao && (
        <div className="rounded-2xl border border-pitch/30 bg-pitch/5 p-5">
          <p className="text-xs uppercase tracking-wide font-semibold text-pitch">
            Link público do bolão
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="text-sm bg-background border border-border rounded-lg px-3 py-2 break-all">
              {publicBolaoUrl(stats.bolao.slug)}
            </code>
            <button
              onClick={copyLink}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-pitch px-3 text-sm font-semibold text-primary-foreground"
            >
              <Copy className="h-4 w-4" /> {copied ? "Copiado!" : "Copiar"}
            </button>
            <Link
              to="/bolao/$slug"
              params={{ slug: stats.bolao.slug }}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-semibold"
            >
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
  const total14 = serie.reduce((s, x) => s + x.total, 0);
  const w = 600;
  const h = 140;
  const pad = 24;
  const bw = serie.length > 0 ? (w - pad * 2) / serie.length : 0;
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold">Palpites nos últimos 14 dias</h2>
        <span className="text-xs text-muted-foreground">Total: {total14}</span>
      </div>
      {serie.length === 0 || total14 === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          Sem palpites no período.
        </p>
      ) : (
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-40" role="img" aria-label="Palpites por dia">
          {serie.map((s, i) => {
            const bh = ((h - pad * 2) * s.total) / max;
            const label = s.dia.slice(5).split("-").reverse().join("/");
            return (
              <g key={s.dia}>
                <title>{`${label}: ${s.total} palpite(s)`}</title>
                <rect
                  x={pad + i * bw + 2}
                  y={h - pad - bh}
                  width={Math.max(1, bw - 4)}
                  height={bh}
                  rx={3}
                  className="fill-pitch/80"
                />
                <text
                  x={pad + i * bw + bw / 2}
                  y={h - 6}
                  textAnchor="middle"
                  className="fill-muted-foreground"
                  fontSize="9"
                >
                  {label}
                </text>
                {s.total > 0 && (
                  <text
                    x={pad + i * bw + bw / 2}
                    y={h - pad - bh - 4}
                    textAnchor="middle"
                    className="fill-foreground"
                    fontSize="10"
                    fontWeight="700"
                  >
                    {s.total}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
