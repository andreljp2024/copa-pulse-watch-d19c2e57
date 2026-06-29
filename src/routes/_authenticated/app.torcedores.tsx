import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Download,
  Search,
  MessageCircle,
  Users,
  Trophy,
  DollarSign,
  Filter,
  Copy,
  CheckCircle2,
  Upload,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/torcedores")({
  component: TorcedoresPage,
});

type Lead = {
  palpite_id: string;
  torcedor_id: string;
  bolao_id: string;
  tenant_id: string;
  nome: string;
  whatsapp: string;
  valor: number;
  palpite_a: number;
  palpite_b: number;
  created_at: string;
  match_id: string;
  kickoff_at: string;
  home: string;
  away: string;
  home_flag: string | null;
  away_flag: string | null;
  status_pagamento: string;
};

type Torcedor = {
  id: string;
  nome: string;
  whatsapp: string;
  palpites: number;
  total: number;
  pagos: number;
  pendentes: number;
  ultimo: string;
};

type StatusFilter = "todos" | "pago" | "pendente";
type ViewMode = "torcedores" | "palpites";



function TorcedoresPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [view, setView] = useState<ViewMode>("torcedores");

  async function loadLeads() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setLoading(false); return; }
    const tRes = await supabase.from("tenants").select("id").eq("owner_user_id", u.user.id).limit(1);
    const tenantRow = Array.isArray(tRes.data) ? tRes.data[0] : tRes.data;
    if (!tenantRow?.id) { setLoading(false); return; }

    const { data: pals } = await supabase
      .from("palpites")
      .select(
        "id, bolao_id, tenant_id, torcedor_id, palpite_a, palpite_b, valor, status_pagamento, created_at, match_id, matches(kickoff_at, home_team_id, away_team_id), torcedores(nome, whatsapp)",
      )
      .eq("tenant_id", tenantRow.id)
      .order("created_at", { ascending: false });

    const { data: ts } = await supabase.from("teams").select("id, name, flag_url");
    const teamMap = new Map((ts ?? []).map((x) => [x.id, x]));

    const mapped: Lead[] = ((pals as any[]) ?? []).map((p: any) => ({
      palpite_id: p.id,
      bolao_id: p.bolao_id,
      tenant_id: p.tenant_id,
      torcedor_id: p.torcedor_id,
      nome: p.torcedores?.nome ?? "",
      whatsapp: p.torcedores?.whatsapp ?? "",
      valor: Number(p.valor ?? 0),
      palpite_a: p.palpite_a,
      palpite_b: p.palpite_b,
      created_at: p.created_at,
      match_id: p.match_id,
      kickoff_at: p.matches?.kickoff_at ?? "",
      home: teamMap.get(p.matches?.home_team_id)?.name ?? "?",
      away: teamMap.get(p.matches?.away_team_id)?.name ?? "?",
      home_flag: teamMap.get(p.matches?.home_team_id)?.flag_url ?? null,
      away_flag: teamMap.get(p.matches?.away_team_id)?.flag_url ?? null,
      status_pagamento: p.status_pagamento,
    }));
    setLeads(mapped);
    setLoading(false);
  }

  useEffect(() => { void loadLeads(); }, []);

  const filteredLeads = useMemo(() => {
    const s = q.trim().toLowerCase();
    return leads.filter((l) => {
      if (statusFilter !== "todos" && l.status_pagamento !== statusFilter) return false;
      if (!s) return true;
      return (
        l.nome.toLowerCase().includes(s) ||
        l.whatsapp.toLowerCase().includes(s) ||
        l.home.toLowerCase().includes(s) ||
        l.away.toLowerCase().includes(s)
      );
    });
  }, [leads, q, statusFilter]);

  const torcedores = useMemo<Torcedor[]>(() => {
    const map = new Map<string, Torcedor>();
    for (const l of filteredLeads) {
      const cur = map.get(l.torcedor_id);
      if (cur) {
        cur.palpites += 1;
        cur.total += l.valor;
        if (l.status_pagamento === "pago") cur.pagos += 1;
        else cur.pendentes += 1;
        if (l.created_at > cur.ultimo) cur.ultimo = l.created_at;
      } else {
        map.set(l.torcedor_id, {
          id: l.torcedor_id,
          nome: l.nome,
          whatsapp: l.whatsapp,
          palpites: 1,
          total: l.valor,
          pagos: l.status_pagamento === "pago" ? 1 : 0,
          pendentes: l.status_pagamento === "pago" ? 0 : 1,
          ultimo: l.created_at,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredLeads]);

  const totals = useMemo(() => {
    const valor = filteredLeads.reduce((s, l) => s + l.valor, 0);
    const pago = filteredLeads
      .filter((l) => l.status_pagamento === "pago")
      .reduce((s, l) => s + l.valor, 0);
    return {
      leads: filteredLeads.length,
      uniques: torcedores.length,
      valor,
      pago,
    };
  }, [filteredLeads, torcedores]);

  function exportCsv() {
    const rows = [
      ["Nome", "WhatsApp", "Jogo", "Data do jogo", "Palpite", "Valor (R$)", "Status", "Cadastro"],
      ...filteredLeads.map((l) => [
        l.nome,
        l.whatsapp,
        `${l.home} x ${l.away}`,
        l.kickoff_at ? new Date(l.kickoff_at).toLocaleString("pt-BR") : "",
        `${l.palpite_a}-${l.palpite_b}`,
        l.valor.toFixed(2),
        l.status_pagamento,
        new Date(l.created_at).toLocaleString("pt-BR"),
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "leads-torcedores.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado");
  }

  function waLink(whats: string, nome: string, msg?: string) {
    const digits = whats.replace(/\D/g, "");
    const text = msg ?? `Olá ${nome.split(" ")[0]}! Tudo certo com seus palpites? 🍀`;
    return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
  }

  function copyWhats(whats: string) {
    navigator.clipboard.writeText(whats);
    toast.success("WhatsApp copiado");
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Torcedores"
        subtitle="Sua base de leads — cada palpite é uma oportunidade."
        icon={<Users className="h-5 w-5" />}
        actions={
          <div className="flex gap-2">
            <Link
              to="/app/contatos"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-pitch px-3 text-sm font-semibold text-primary-foreground"
            >
              <Upload className="h-4 w-4" /> Importar CSV
            </Link>
            <button
              onClick={exportCsv}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-semibold hover:bg-accent/10"
            >
              <Download className="h-4 w-4" /> Exportar CSV
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Torcedores"
          value={String(totals.uniques)}
          icon={<Users className="h-4 w-4" />}
          tone="default"
        />
        <StatCard
          label="Palpites"
          value={String(totals.leads)}
          icon={<Trophy className="h-4 w-4" />}
          tone="default"
        />
        <StatCard
          label="Total apostado"
          value={`R$ ${totals.valor.toFixed(2)}`}
          icon={<DollarSign className="h-4 w-4" />}
          tone="default"
        />
        <StatCard
          label="Já recebido"
          value={`R$ ${totals.pago.toFixed(2)}`}
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="success"
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-lg border border-border p-1 bg-card">
          <TabBtn active={view === "torcedores"} onClick={() => setView("torcedores")}>
            Por torcedor
          </TabBtn>
          <TabBtn active={view === "palpites"} onClick={() => setView("palpites")}>
            Todos os palpites
          </TabBtn>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-border p-1 bg-card text-xs">
            <FilterBtn active={statusFilter === "todos"} onClick={() => setStatusFilter("todos")}>
              <Filter className="h-3 w-3" /> Todos
            </FilterBtn>
            <FilterBtn active={statusFilter === "pago"} onClick={() => setStatusFilter("pago")}>
              Pagos
            </FilterBtn>
            <FilterBtn
              active={statusFilter === "pendente"}
              onClick={() => setStatusFilter("pendente")}
            >
              Pendentes
            </FilterBtn>
          </div>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome, WhatsApp ou time..."
          className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-pitch/40"
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : filteredLeads.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
          <Users className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-semibold">Nenhum torcedor encontrado</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Compartilhe o link público do bolão para captar leads.
          </p>
        </div>
      ) : view === "torcedores" ? (
        <div className="grid gap-3 md:grid-cols-2">
          {torcedores.map((t) => (
            <div
              key={t.id}
              className="rounded-2xl border border-border bg-card p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-display text-lg font-bold truncate">{t.nome}</div>
                  <div className="text-xs text-muted-foreground font-mono">{t.whatsapp || "—"}</div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {t.whatsapp && (
                    <>
                      <button
                        onClick={() => copyWhats(t.whatsapp)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border hover:bg-accent/10"
                        title="Copiar WhatsApp"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <a
                        href={waLink(t.whatsapp, t.nome)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-8 items-center gap-1 rounded-md bg-green-600 px-2 text-xs font-semibold text-white"
                      >
                        <MessageCircle className="h-3 w-3" /> WhatsApp
                      </a>
                    </>
                  )}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <Mini label="Palpites" value={String(t.palpites)} />
                <Mini label="Pagos" value={String(t.pagos)} tone="success" />
                <Mini label="Pendentes" value={String(t.pendentes)} tone="warn" />
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className="font-bold">R$ {t.total.toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase">
              <tr>
                <th className="px-4 py-2">Nome</th>
                <th className="px-4 py-2">WhatsApp</th>
                <th className="px-4 py-2">Jogo</th>
                <th className="px-4 py-2">Data</th>
                <th className="px-4 py-2">Palpite</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 text-right">Valor</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((l) => (
                <tr key={l.palpite_id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-4 py-2 font-medium">{l.nome}</td>
                  <td className="px-4 py-2 text-muted-foreground font-mono text-xs">
                    {l.whatsapp}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      {l.home_flag && (
                        <img
                          src={l.home_flag}
                          alt=""
                          className="h-4 w-6 object-cover rounded-sm ring-1 ring-border"
                        />
                      )}
                      <span className="font-medium">{l.home}</span>
                      <span className="text-muted-foreground">x</span>
                      <span className="font-medium">{l.away}</span>
                      {l.away_flag && (
                        <img
                          src={l.away_flag}
                          alt=""
                          className="h-4 w-6 object-cover rounded-sm ring-1 ring-border"
                        />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground text-xs">
                    {l.kickoff_at
                      ? new Date(l.kickoff_at).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-2 font-mono">
                    {l.palpite_a}–{l.palpite_b}
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={l.status_pagamento} />
                  </td>
                  <td className="px-4 py-2 text-right font-semibold">
                    R$ {l.valor.toFixed(2)}
                  </td>
                  <td className="px-4 py-2">
                    {l.whatsapp && (
                      <a
                        href={waLink(l.whatsapp, l.nome, `Olá ${l.nome.split(" ")[0]}! Obrigado pelo palpite em ${l.home} x ${l.away}. 🍀`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-8 items-center gap-1 rounded-md bg-green-600 px-2 text-xs font-semibold text-white"
                      >
                        <MessageCircle className="h-3 w-3" /> WhatsApp
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
  icon?: React.ReactNode;
  tone?: "default" | "success";
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div
        className={`mt-1 text-xl font-black ${tone === "success" ? "text-green-600" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 h-8 rounded-md text-xs font-semibold transition-colors ${
        active ? "bg-pitch text-pitch-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function FilterBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2.5 h-7 rounded-md font-semibold transition-colors ${
        active ? "bg-accent/20 text-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Mini({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "warn";
}) {
  const color =
    tone === "success" ? "text-green-600" : tone === "warn" ? "text-amber-600" : "";
  return (
    <div className="rounded-lg bg-muted/40 p-2">
      <div className={`text-base font-black ${color}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const pago = status === "pago";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        pago ? "bg-green-600/15 text-green-700" : "bg-amber-500/15 text-amber-700"
      }`}
    >
      {pago ? "Pago" : "Pendente"}
    </span>
  );
}
