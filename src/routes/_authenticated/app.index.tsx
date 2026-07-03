import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { brl, publicBolaoUrl, LIMITE_PALPITES_FREE, LIMITE_PALPITES_AVISO, buildDevWhatsAppLink } from "@/lib/saas";
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
  Shield,
  AlertTriangle,
  Lock,
  MessageCircle,
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
  taxa_conversao: number;
  ticket_medio: number;
  ltv_torcedor: number;
  notif_pendentes: number;
  notif_enviadas: number;
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
          taxa_conversao: 0,
          ticket_medio: 0,
          ltv_torcedor: 0,
          notif_pendentes: 0,
          notif_enviadas: 0,
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
      const [dash, serieRows, notifPend, notifSent] = await Promise.all([
        // MV agregada — substitui 5 counts/somas
        supabase.rpc("get_dashboard_organizador"),
        supabase
          .from("palpites")
          .select("created_at")
          .eq("tenant_id", t.id)
          .gte("created_at", desde14)
          .limit(10000),
        supabase
          .from("notification_queue")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", t.id)
          .in("status", ["pending", "sending"]),
        supabase
          .from("notification_queue")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", t.id)
          .eq("status", "sent"),
      ]);

      if (dash.error) throw dash.error;
      const row = (dash.data ?? []).find((r) => r.tenant_id === t.id) ?? null;
      const total = Number(row?.total_palpites ?? 0);
      const pagos = Number(row?.palpites_pagos ?? 0);
      const pendentes = Number(row?.palpites_pendentes ?? 0);
      const torcedoresCount = Number(row?.total_torcedores ?? 0);
      const arrecadado = Number(row?.receita_paga ?? 0);
      const ganhadoresCount = Number(row?.total_ganhadores ?? 0);
      const pct = Number((bo as { percentual_admin?: number } | null)?.percentual_admin ?? 30);
      const taxa_admin = arrecadado * (pct / 100);
      const premio_torcedores = arrecadado - taxa_admin;
      const taxa_conversao = total > 0 ? (pagos / total) * 100 : 0;
      const ticket_medio = pagos > 0 ? arrecadado / pagos : 0;
      const ltv_torcedor = torcedoresCount > 0 ? arrecadado / torcedoresCount : 0;

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
        torcedores: torcedoresCount,
        palpites: total,
        pagos,
        pendentes,
        arrecadado,
        ganhadores: ganhadoresCount,
        taxa_admin,
        premio_torcedores,
        taxa_conversao,
        ticket_medio,
        ltv_torcedor,
        notif_pendentes: notifPend.count ?? 0,
        notif_enviadas: notifSent.count ?? 0,
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
    {
      label: "Taxa de conversão",
      value: `${stats.taxa_conversao.toFixed(1)}%`,
      icon: Sparkles,
      hint: "Palpites pagos ÷ palpites totais",
    },
    { label: "Ticket médio", value: brl(stats.ticket_medio), icon: DollarSign, hint: "Arrecadado ÷ palpites pagos" },
    { label: "LTV do torcedor", value: brl(stats.ltv_torcedor), icon: Users, hint: "Arrecadado ÷ nº torcedores" },
    { label: "Arrecadado", value: brl(stats.arrecadado), icon: DollarSign },
    {
      label: `Taxa de organização (${stats.bolao?.percentual_admin ?? 20}%)`,
      value: brl(stats.taxa_admin),
      icon: DollarSign,
    },
    { label: "Prêmio aos torcedores", value: brl(stats.premio_torcedores), icon: Trophy },
    { label: "Ganhadores", value: stats.ganhadores, icon: Trophy },
    {
      label: "Notif. WhatsApp",
      value: `${stats.notif_enviadas} enviadas · ${stats.notif_pendentes} na fila`,
      icon: MessageCircle,
      hint: "Envios automáticos via Evolution API",
    },
  ] as Array<{ label: string; value: string | number; icon: typeof Users; hint?: string }>;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-gold/30 bg-hero p-6 sm:p-8 shadow-card">
        <div className="pointer-events-none absolute inset-0 bg-mesh opacity-70" />
        <div className="pointer-events-none absolute -top-16 -right-10 h-64 w-64 rounded-full bg-gold/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-16 h-72 w-72 rounded-full bg-pitch/30 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-background/40 px-3 py-1 text-xs font-semibold text-gold backdrop-blur">
              <Shield className="h-3.5 w-3.5" /> Rumo ao Hexa 🇧🇷
            </span>
            <h1 className="font-display text-3xl sm:text-4xl font-black tracking-tight">
              Painel do <span className="text-gradient-gold">organizador</span>
            </h1>
            {stats.bolao ? (
              <p className="text-sm text-muted-foreground">
                Bolão ativo: <strong className="text-foreground">{stats.bolao.nome}</strong>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhum bolão criado ainda.{" "}
                <Link to="/app/bolao" className="font-semibold text-gold underline">
                  Criar bolão
                </Link>
              </p>
            )}
          </div>
          <div className="relative flex flex-wrap items-center gap-2">
            <button
              onClick={refresh}
              disabled={refreshing}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border/70 bg-card/60 px-3 text-sm font-semibold backdrop-blur transition hover:bg-card disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Atualizar
            </button>
            <button
              onClick={runCompute}
              disabled={computing}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-gold px-4 text-sm font-black text-[color:var(--gold-foreground)] shadow-gold transition hover:scale-105 disabled:opacity-60"
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
      </div>

      <LimiteBanner totalPalpites={stats.palpites} bolaoNome={stats.bolao?.nome ?? null} />

      {stats.bolao && (
        <div className="rounded-2xl border border-gold/30 bg-card/60 p-5 backdrop-blur shadow-card">
          <p className="text-xs uppercase tracking-wide font-semibold text-gold">
            Link público do bolão
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="text-sm bg-background/60 border border-border rounded-lg px-3 py-2 break-all">
              {publicBolaoUrl(stats.bolao.slug)}
            </code>
            <button
              onClick={copyLink}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-gradient-pitch px-3 text-sm font-semibold text-primary-foreground shadow-glow transition hover:scale-105"
            >
              <Copy className="h-4 w-4" /> {copied ? "Copiado!" : "Copiar"}
            </button>
            <Link
              to="/bolao/$slug"
              params={{ slug: stats.bolao.slug }}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-semibold hover:bg-card"
            >
              <ExternalLink className="h-4 w-4" /> Abrir
            </Link>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, hint }, i) => {
          const tones = ["from-pitch/25", "from-gold/25", "from-brand-blue/25", "from-destructive/25"];
          const tone = tones[i % tones.length];
          return (
            <div
              key={label}
              className={`group relative overflow-hidden rounded-2xl border border-gold/20 bg-gradient-to-br ${tone} to-transparent bg-card/60 p-5 backdrop-blur shadow-card transition hover:-translate-y-0.5 hover:border-gold/50`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wide font-semibold text-muted-foreground">
                  {label}
                </span>
                <Icon className="h-4 w-4 text-gold" />
              </div>
              <p className="mt-2 text-3xl font-black font-display">{value}</p>
              {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
            </div>
          );
        })}
      </div>


      <Sparkline serie={stats.serie} />
    </div>
  );
}

function LimiteBanner({ totalPalpites, bolaoNome }: { totalPalpites: number; bolaoNome: string | null }) {
  if (totalPalpites < LIMITE_PALPITES_AVISO) return null;
  const bloqueado = totalPalpites >= LIMITE_PALPITES_FREE;
  const msg = bloqueado
    ? `Olá! Meu bolão *${bolaoNome ?? "Bolão AI"}* atingiu ${totalPalpites}/${LIMITE_PALPITES_FREE} palpites e travou. Preciso desbloquear para continuar recebendo palpites. 🏆⚽`
    : `Olá! Meu bolão *${bolaoNome ?? "Bolão AI"}* já está com ${totalPalpites}/${LIMITE_PALPITES_FREE} palpites. Quero conversar sobre limites maiores. 🏆⚽`;
  const link = buildDevWhatsAppLink(msg);
  return (
    <div
      className={`rounded-2xl border p-5 shadow-card ${bloqueado ? "border-destructive/50 bg-destructive/10" : "border-gold/40 bg-gold/10"}`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${bloqueado ? "bg-destructive text-destructive-foreground" : "bg-gold text-gold-foreground"}`}>
          {bloqueado ? <Lock className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-black uppercase tracking-wide ${bloqueado ? "text-destructive" : "text-gold"}`}>
            {bloqueado ? "Bolão travado — limite do plano Grátis atingido" : "Você está chegando no limite do plano Grátis"}
          </p>
          <p className="mt-1 text-sm text-foreground">
            {bloqueado
              ? `Seu bolão atingiu ${totalPalpites}/${LIMITE_PALPITES_FREE} palpites. Fale com o Dev pelo WhatsApp para desbloquear e continuar recebendo palpites.`
              : `Você já tem ${totalPalpites}/${LIMITE_PALPITES_FREE} palpites. A partir de ${LIMITE_PALPITES_FREE} o sistema trava. Fale com o Dev para consultar limites maiores.`}
          </p>
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className={`mt-3 inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-bold ${bloqueado ? "bg-destructive text-destructive-foreground" : "bg-gradient-gold text-gold-foreground shadow-gold"}`}
          >
            <MessageCircle className="h-4 w-4" /> {bloqueado ? "Desbloquear com o Dev" : "Falar com o Dev"}
          </a>
        </div>
      </div>
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
