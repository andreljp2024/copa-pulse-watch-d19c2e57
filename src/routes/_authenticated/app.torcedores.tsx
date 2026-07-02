import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  RefreshCw,
  Loader2,
  Undo2,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import { brl } from "@/lib/saas";
import { maskPhone } from "@/lib/masks";
import { ptTeamName } from "@/components/MatchCard";

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
type SortKey = "recentes" | "valor" | "palpites" | "nome";

function TorcedoresPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [view, setView] = useState<ViewMode>("torcedores");
  const [sortKey, setSortKey] = useState<SortKey>("valor");
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadLeads = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: tenantRow } = await supabase
        .from("tenants")
        .select("id")
        .eq("owner_user_id", u.user.id)
        .maybeSingle();
      if (!tenantRow?.id) return;

      const [{ data: pals, error }, { data: ts }] = await Promise.all([
        supabase
          .from("palpites")
          .select(
            "id, bolao_id, tenant_id, torcedor_id, palpite_a, palpite_b, valor, status_pagamento, created_at, match_id, matches(kickoff_at, home_team_id, away_team_id), torcedores(nome, whatsapp)",
          )
          .eq("tenant_id", tenantRow.id)
          .order("created_at", { ascending: false }),
        supabase.from("teams").select("id, name, flag_url"),
      ]);

      if (error) {
        toast.error("Falha ao carregar palpites");
        return;
      }

      const teamMap = new Map((ts ?? []).map((x) => [x.id, x] as const));

      const mapped: Lead[] = ((pals ?? []) as Array<Record<string, unknown>>).map((p) => {
        const t = p.torcedores as { nome?: string; whatsapp?: string } | null;
        const m = p.matches as { kickoff_at?: string; home_team_id?: string; away_team_id?: string } | null;
        const home = m?.home_team_id ? teamMap.get(m.home_team_id) : undefined;
        const away = m?.away_team_id ? teamMap.get(m.away_team_id) : undefined;
        return {
          palpite_id: String(p.id),
          bolao_id: String(p.bolao_id ?? ""),
          tenant_id: String(p.tenant_id ?? ""),
          torcedor_id: String(p.torcedor_id ?? ""),
          nome: t?.nome ?? "",
          whatsapp: t?.whatsapp ?? "",
          valor: Number(p.valor ?? 0),
          palpite_a: Number(p.palpite_a ?? 0),
          palpite_b: Number(p.palpite_b ?? 0),
          created_at: String(p.created_at ?? ""),
          match_id: String(p.match_id ?? ""),
          kickoff_at: m?.kickoff_at ?? "",
          home: ptTeamName(home?.name) || "?",
          away: ptTeamName(away?.name) || "?",
          home_flag: home?.flag_url ?? null,
          away_flag: away?.flag_url ?? null,
          status_pagamento: String(p.status_pagamento ?? "pendente"),
        };
      });
      setLeads(mapped);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

  const filteredLeads = useMemo(() => {
    const s = q.trim().toLowerCase();
    return leads.filter((l) => {
      if (statusFilter !== "todos" && l.status_pagamento !== statusFilter) return false;
      if (!s) return true;
      const digits = s.replace(/\D/g, "");
      return (
        l.nome.toLowerCase().includes(s) ||
        (digits && l.whatsapp.replace(/\D/g, "").includes(digits)) ||
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
    const arr = Array.from(map.values());
    switch (sortKey) {
      case "nome":
        arr.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
        break;
      case "palpites":
        arr.sort((a, b) => b.palpites - a.palpites);
        break;
      case "recentes":
        arr.sort((a, b) => (a.ultimo < b.ultimo ? 1 : -1));
        break;
      case "valor":
      default:
        arr.sort((a, b) => b.total - a.total);
    }
    return arr;
  }, [filteredLeads, sortKey]);

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

  async function togglePago(palpite: Lead) {
    const novo = palpite.status_pagamento === "pago" ? "pendente" : "pago";
    setBusyId(palpite.palpite_id);
    const { error } = await supabase
      .from("palpites")
      .update({ status_pagamento: novo })
      .eq("id", palpite.palpite_id);
    setBusyId(null);
    if (error) {
      toast.error("Não foi possível atualizar o status");
      return;
    }
    setLeads((prev) =>
      prev.map((l) => (l.palpite_id === palpite.palpite_id ? { ...l, status_pagamento: novo } : l)),
    );
    toast.success(novo === "pago" ? "Marcado como pago" : "Voltou para pendente");
  }

  function exportCsv() {
    const rows = [
      ["Nome", "WhatsApp", "Jogo", "Data do jogo", "Palpite", "Valor (R$)", "Status", "Cadastro"],
      ...filteredLeads.map((l) => [
        l.nome,
        maskPhone(l.whatsapp),
        `${l.home} x ${l.away}`,
        l.kickoff_at ? new Date(l.kickoff_at).toLocaleString("pt-BR") : "",
        `${l.palpite_a}-${l.palpite_b}`,
        l.valor.toFixed(2).replace(".", ","),
        l.status_pagamento,
        new Date(l.created_at).toLocaleString("pt-BR"),
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\r\n");
    // BOM UTF-8 para abertura correta no Excel
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `torcedores-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado");
  }

  function waLink(whats: string, nome: string, msg?: string) {
    const digits = whats.replace(/\D/g, "");
    const fone = digits.startsWith("55") ? digits : `55${digits}`;
    const primeiro = nome.split(" ")[0] || "torcedor";
    const text = msg ?? `Olá ${primeiro}! Tudo certo com seus palpites? 🍀`;
    return `https://wa.me/${fone}?text=${encodeURIComponent(text)}`;
  }

  function copyWhats(whats: string) {
    navigator.clipboard.writeText(maskPhone(whats));
    toast.success("WhatsApp copiado");
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Torcedores"
        subtitle="Sua base de leads — cada palpite é uma oportunidade."
        icon={<Users className="h-5 w-5" />}
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void loadLeads(true)}
              disabled={refreshing || loading}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-semibold hover:bg-accent/10 disabled:opacity-50"
              title="Atualizar"
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Atualizar
            </button>
            <Link
              to="/app/contatos"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-pitch px-3 text-sm font-semibold text-primary-foreground"
            >
              <Upload className="h-4 w-4" /> Importar CSV
            </Link>
            <button
              onClick={exportCsv}
              disabled={filteredLeads.length === 0}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-semibold hover:bg-accent/10 disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> Exportar CSV
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Torcedores" value={String(totals.uniques)} icon={<Users className="h-4 w-4" />} />
        <StatCard label="Palpites" value={String(totals.leads)} icon={<Trophy className="h-4 w-4" />} />
        <StatCard label="Total apostado" value={brl(totals.valor)} icon={<DollarSign className="h-4 w-4" />} />
        <StatCard label="Já recebido" value={brl(totals.pago)} icon={<CheckCircle2 className="h-4 w-4" />} tone="success" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-lg border border-border p-1 bg-card">
          <TabBtn active={view === "torcedores"} onClick={() => setView("torcedores")}>Por torcedor</TabBtn>
          <TabBtn active={view === "palpites"} onClick={() => setView("palpites")}>Todos os palpites</TabBtn>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-border p-1 bg-card text-xs">
            <FilterBtn active={statusFilter === "todos"} onClick={() => setStatusFilter("todos")}>
              <Filter className="h-3 w-3" /> Todos
            </FilterBtn>
            <FilterBtn active={statusFilter === "pago"} onClick={() => setStatusFilter("pago")}>Pagos</FilterBtn>
            <FilterBtn active={statusFilter === "pendente"} onClick={() => setStatusFilter("pendente")}>Pendentes</FilterBtn>
          </div>
          {view === "torcedores" && (
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="h-8 rounded-md border border-border bg-card px-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-pitch/40"
              aria-label="Ordenar torcedores"
            >
              <option value="valor">Maior valor</option>
              <option value="palpites">Mais palpites</option>
              <option value="recentes">Mais recentes</option>
              <option value="nome">Nome (A–Z)</option>
            </select>
          )}
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
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-4 animate-pulse">
              <div className="h-4 w-40 bg-muted rounded" />
              <div className="mt-2 h-3 w-32 bg-muted rounded" />
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="h-12 bg-muted rounded" />
                <div className="h-12 bg-muted rounded" />
                <div className="h-12 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
          <Users className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm font-semibold">
            {leads.length === 0 ? "Nenhum torcedor ainda" : "Nenhum resultado com os filtros atuais"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {leads.length === 0
              ? "Compartilhe o link público do bolão para captar leads."
              : "Ajuste a busca ou o filtro de status."}
          </p>
        </div>
      ) : view === "torcedores" ? (
        <div className="grid gap-3 md:grid-cols-2">
          {torcedores.map((t) => (
            <div key={t.id} className="rounded-2xl border border-border bg-card p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-display text-lg font-bold truncate">{t.nome || "Sem nome"}</div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {t.whatsapp ? maskPhone(t.whatsapp) : "—"}
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {t.whatsapp && (
                    <>
                      <button
                        onClick={() => copyWhats(t.whatsapp)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border hover:bg-accent/10"
                        title="Copiar WhatsApp"
                        aria-label="Copiar WhatsApp"
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
                <span className="font-bold">{brl(t.total)}</span>
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
                  <td className="px-4 py-2 font-medium">{l.nome || "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground font-mono text-xs">
                    {l.whatsapp ? maskPhone(l.whatsapp) : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      {l.home_flag && (
                        <img src={l.home_flag} alt="" className="h-4 w-6 object-cover rounded-sm ring-1 ring-border" />
                      )}
                      <span className="font-medium">{l.home}</span>
                      <span className="text-muted-foreground">x</span>
                      <span className="font-medium">{l.away}</span>
                      {l.away_flag && (
                        <img src={l.away_flag} alt="" className="h-4 w-6 object-cover rounded-sm ring-1 ring-border" />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground text-xs whitespace-nowrap">
                    {l.kickoff_at
                      ? new Date(l.kickoff_at).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-2 font-mono">{l.palpite_a}–{l.palpite_b}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={l.status_pagamento} />
                  </td>
                  <td className="px-4 py-2 text-right font-semibold whitespace-nowrap">{brl(l.valor)}</td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => void togglePago(l)}
                        disabled={busyId === l.palpite_id}
                        className={`inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-semibold border transition-colors ${
                          l.status_pagamento === "pago"
                            ? "border-amber-500/40 text-amber-700 hover:bg-amber-500/10"
                            : "border-green-600/40 text-green-700 hover:bg-green-600/10"
                        } disabled:opacity-50`}
                        title={l.status_pagamento === "pago" ? "Marcar como pendente" : "Marcar como pago"}
                      >
                        {busyId === l.palpite_id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : l.status_pagamento === "pago" ? (
                          <Undo2 className="h-3 w-3" />
                        ) : (
                          <CheckCircle2 className="h-3 w-3" />
                        )}
                        {l.status_pagamento === "pago" ? "Estornar" : "Marcar pago"}
                      </button>
                      {l.whatsapp && (
                        <a
                          href={waLink(
                            l.whatsapp,
                            l.nome,
                            `Olá ${l.nome.split(" ")[0]}! Obrigado pelo palpite em ${l.home} x ${l.away}. 🍀`,
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-8 items-center gap-1 rounded-md bg-green-600 px-2 text-xs font-semibold text-white"
                        >
                          <MessageCircle className="h-3 w-3" /> WhatsApp
                        </a>
                      )}
                    </div>
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
      <div className={`mt-1 text-xl font-black ${tone === "success" ? "text-green-600" : ""}`}>{value}</div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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

function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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
  const color = tone === "success" ? "text-green-600" : tone === "warn" ? "text-amber-600" : "";
  return (
    <div className="rounded-lg bg-muted/40 p-2">
      <div className={`text-base font-black ${color}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const pago = status === "pago";
  const cancelado = status === "cancelado";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        pago
          ? "bg-green-600/15 text-green-700"
          : cancelado
            ? "bg-muted text-muted-foreground"
            : "bg-amber-500/15 text-amber-700"
      }`}
    >
      {pago ? "Pago" : cancelado ? "Cancelado" : "Pendente"}
    </span>
  );
}
