import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { brl, publicBolaoUrl } from "@/lib/saas";
import { Users, ListChecks, CheckCircle2, Clock, DollarSign, Trophy, Copy, ExternalLink } from "lucide-react";

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
};

function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { void load(); }, []);

  async function load() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data: t } = await supabase.from("tenants").select("id").eq("owner_user_id", u.user.id).maybeSingle();
    if (!t) return;
    const { data: bo } = await supabase.from("boloes").select("id, nome, slug, valor_palpite").eq("tenant_id", t.id).order("created_at", { ascending: true }).limit(1).maybeSingle();
    const [tor, pal, gan] = await Promise.all([
      supabase.from("torcedores").select("id", { count: "exact", head: true }).eq("tenant_id", t.id),
      supabase.from("palpites").select("status_pagamento, valor", { count: "exact" }).eq("tenant_id", t.id),
      supabase.from("ganhadores").select("id", { count: "exact", head: true }).eq("tenant_id", t.id),
    ]);
    const palpites = pal.data ?? [];
    const pagos = palpites.filter((p) => p.status_pagamento === "pago").length;
    const arrecadado = palpites.filter((p) => p.status_pagamento === "pago").reduce((s, p) => s + Number(p.valor ?? 0), 0);
    setStats({
      torcedores: tor.count ?? 0,
      palpites: pal.count ?? 0,
      pagos,
      pendentes: (pal.count ?? 0) - pagos,
      arrecadado,
      ganhadores: gan.count ?? 0,
      bolao: bo ? { id: bo.id, nome: bo.nome, slug: bo.slug, valor_palpite: Number(bo.valor_palpite) } : null,
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
      <div>
        <h1 className="text-2xl font-black">Dashboard</h1>
        {stats.bolao && <p className="text-sm text-muted-foreground">Bolão ativo: <strong>{stats.bolao.nome}</strong></p>}
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
    </div>
  );
}
