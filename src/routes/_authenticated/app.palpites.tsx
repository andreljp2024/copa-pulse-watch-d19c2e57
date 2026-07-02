import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { brl, buildWhatsAppLink } from "@/lib/saas";
import { maskPhone } from "@/lib/masks";
import { ptTeamName } from "@/components/MatchCard";
import { toast } from "sonner";
import {
  CheckCircle2,
  XCircle,
  Download,
  MessageCircle,
  FileText,
  Filter,
  ListChecks,
  DollarSign,
  Clock,
  Ban,
  Search,
  RefreshCw,
  Undo2,
  Loader2,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/_authenticated/app/palpites")({
  component: PalpitesPage,
});

type Row = {
  id: string;
  codigo: number | null;
  bolao_id: string;
  palpite_a: number;
  palpite_b: number;
  valor: number;
  status_pagamento: string;
  created_at: string;
  torcedores: { nome: string; whatsapp: string } | null;
  matches: {
    home_team_id: string | null;
    away_team_id: string | null;
    kickoff_at: string | null;
  } | null;
  boloes: { nome: string; slug: string } | null;
};

function fmtProtocolo(c: number | null) {
  return c ? `BOL-${String(c).padStart(4, "0")}` : "—";
}

function PalpitesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [teams, setTeams] = useState<Map<string, string>>(new Map());
  const [filters, setFilters] = useState({
    status: "todos",
    bolaoSlug: "todos",
    search: "",
    dataDe: "",
    dataAte: "",
  });
  const [showFilters, setShowFilters] = useState(false);

  const teamName = (id: string | null | undefined) =>
    ptTeamName(teams.get(id ?? "") ?? "") || "?";

  async function load(silent = false) {
    if (silent) setRefreshing(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const tRes = await supabase
        .from("tenants")
        .select("id")
        .eq("owner_user_id", u.user.id)
        .limit(1);
      const t = Array.isArray(tRes.data) ? tRes.data[0] : tRes.data;
      if (!t) return;
      const [{ data: pals, error: e1 }, { data: ts, error: e2 }] = await Promise.all([
        supabase
          .from("palpites")
          .select(
            "id, codigo, bolao_id, palpite_a, palpite_b, valor, status_pagamento, created_at, torcedores(nome, whatsapp), matches(home_team_id, away_team_id, kickoff_at), boloes(nome, slug)",
          )
          .eq("tenant_id", t.id)
          .order("created_at", { ascending: false }),
        supabase.from("teams").select("id, name"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      setRows((pals as unknown as Row[]) ?? []);
      setTeams(new Map((ts ?? []).map((x) => [x.id, x.name])));
    } catch (err) {
      console.error(err);
      toast.error("Falha ao carregar palpites");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  async function setStatus(id: string, status: string) {
    setBusyId(id);
    try {
      const { error } = await supabase
        .from("palpites")
        .update({ status_pagamento: status })
        .eq("id", id);
      if (error) throw error;
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status_pagamento: status } : r)));
      toast.success(
        status === "pago"
          ? "Palpite confirmado como pago"
          : status === "cancelado"
            ? "Palpite cancelado"
            : "Status atualizado",
      );
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível atualizar o status");
    } finally {
      setBusyId(null);
    }
  }

  function aprovarEEnviar(r: Row) {
    const home = teamName(r.matches?.home_team_id);
    const away = teamName(r.matches?.away_team_id);
    const protocolo = fmtProtocolo(r.codigo);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const slug = r.boloes?.slug ?? "";
    const whatsappDigits = (r.torcedores?.whatsapp ?? "").replace(/\D+/g, "");
    const linkConsulta = slug ? `${origin}/meus-palpites/${slug}?w=${whatsappDigits}` : "";
    const msg =
      `Obrigado, ${r.torcedores?.nome ?? ""}! 🙏\n\n` +
      `Confirmamos o recebimento do seu pagamento de *${brl(r.valor)}* no *${r.boloes?.nome ?? ""}*.\n\n` +
      `Protocolo: *${protocolo}*\n` +
      `Jogo: ${home} x ${away}\n` +
      `Seu palpite: *${r.palpite_a} x ${r.palpite_b}*\n` +
      `Status: *Pago ✅*\n\n` +
      (linkConsulta
        ? `📲 Acompanhe o resultado dos seus palpites a qualquer momento:\n${linkConsulta}\n\n` +
          `(O acesso é vinculado a este número de WhatsApp — basta informá-lo na consulta.)\n\n`
        : "") +
      `Boa sorte! 🍀`;
    const link = buildWhatsAppLink(r.torcedores?.whatsapp ?? "", msg);
    void setStatus(r.id, "pago");
    window.open(link, "_blank", "noopener,noreferrer");
  }

  function lembrarPagamento(r: Row) {
    const home = teamName(r.matches?.home_team_id);
    const away = teamName(r.matches?.away_team_id);
    const protocolo = fmtProtocolo(r.codigo);
    const kickoff = r.matches?.kickoff_at
      ? new Date(r.matches.kickoff_at).toLocaleString("pt-BR", {
          dateStyle: "short",
          timeStyle: "short",
        })
      : "o início do jogo";
    const msg =
      `Olá, ${r.torcedores?.nome ?? ""}!\n\n` +
      `Recebemos seu palpite no ${r.boloes?.nome ?? ""} (Protocolo ${protocolo}).\n` +
      `Jogo: ${home} x ${away}\n` +
      `Palpite: ${r.palpite_a} x ${r.palpite_b}\n` +
      `Valor: ${brl(r.valor)}\n\n` +
      `⚠️ Seu palpite ainda está *pendente*. Envie o comprovante do PIX por aqui até ${kickoff} para confirmar. ` +
      `Após o início do jogo, palpites não confirmados serão cancelados.\n\nObrigado!`;
    const link = buildWhatsAppLink(r.torcedores?.whatsapp ?? "", msg);
    window.open(link, "_blank", "noopener,noreferrer");
  }

  const boloesUnicos = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) if (r.boloes?.slug) map.set(r.boloes.slug, r.boloes.nome);
    return [...map.entries()].map(([slug, nome]) => ({ slug, nome }));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    const de = filters.dataDe ? new Date(filters.dataDe).getTime() : null;
    const ate = filters.dataAte ? new Date(filters.dataAte + "T23:59:59").getTime() : null;
    return rows.filter((r) => {
      if (filters.status !== "todos" && r.status_pagamento !== filters.status) return false;
      if (filters.bolaoSlug !== "todos" && r.boloes?.slug !== filters.bolaoSlug) return false;
      const ts = new Date(r.created_at).getTime();
      if (de !== null && ts < de) return false;
      if (ate !== null && ts > ate) return false;
      if (q) {
        const home = teamName(r.matches?.home_team_id);
        const away = teamName(r.matches?.away_team_id);
        const hay =
          `${r.torcedores?.nome ?? ""} ${r.torcedores?.whatsapp ?? ""} ${fmtProtocolo(r.codigo)} ${home} ${away} ${r.boloes?.nome ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, filters]);

  const totals = useMemo(() => {
    const pagos = filtered.filter((r) => r.status_pagamento === "pago");
    return {
      qtd: filtered.length,
      qtdPagos: pagos.length,
      arrecadado: pagos.reduce((s, r) => s + Number(r.valor ?? 0), 0),
      pendentes: filtered.filter((r) => r.status_pagamento === "pendente").length,
      cancelados: filtered.filter((r) => r.status_pagamento === "cancelado").length,
    };
  }, [filtered]);

  function exportCsv() {
    const data = [
      ["Protocolo", "Torcedor", "WhatsApp", "Bolão", "Jogo", "Palpite", "Valor", "Status", "Data"],
      ...filtered.map((r) => [
        fmtProtocolo(r.codigo),
        r.torcedores?.nome ?? "",
        maskPhone(r.torcedores?.whatsapp ?? ""),
        r.boloes?.nome ?? "",
        `${teamName(r.matches?.home_team_id)} x ${teamName(r.matches?.away_team_id)}`,
        `${r.palpite_a} x ${r.palpite_b}`,
        brl(r.valor),
        r.status_pagamento,
        new Date(r.created_at).toLocaleString("pt-BR"),
      ]),
    ];
    const csv = data
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "palpites.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPdf() {
    const esc = (s: unknown) =>
      String(s ?? "").replace(
        /[&<>"']/g,
        (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
      );
    const statusLabel = filters.status === "todos" ? "Todos" : filters.status;
    const bolaoLabel =
      filters.bolaoSlug === "todos"
        ? "Todos"
        : (boloesUnicos.find((b) => b.slug === filters.bolaoSlug)?.nome ?? filters.bolaoSlug);
    const periodo =
      filters.dataDe || filters.dataAte
        ? `${filters.dataDe || "início"} → ${filters.dataAte || "hoje"}`
        : "Todo o período";
    const linhas = filtered
      .map(
        (r) => `
      <tr>
        <td class="mono">${esc(fmtProtocolo(r.codigo))}</td>
        <td>${esc(r.torcedores?.nome ?? "")}<div class="sub">${esc(maskPhone(r.torcedores?.whatsapp ?? ""))}</div></td>
        <td>${esc(r.boloes?.nome ?? "")}</td>
        <td>${esc(teamName(r.matches?.home_team_id) + " x " + teamName(r.matches?.away_team_id))}</td>
        <td class="b">${esc(r.palpite_a)} x ${esc(r.palpite_b)}</td>
        <td>${esc(brl(r.valor))}</td>
        <td><span class="pill pill-${esc(r.status_pagamento)}">${esc(r.status_pagamento)}</span></td>
        <td>${esc(new Date(r.created_at).toLocaleString("pt-BR"))}</td>
      </tr>`,
      )
      .join("");
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório de Palpites</title>
<style>
  *{box-sizing:border-box} body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111;margin:24px}
  h1{margin:0 0 4px;font-size:20px} .meta{color:#555;font-size:12px;margin-bottom:16px}
  .grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:12px 0 18px}
  .kpi{border:1px solid #ddd;border-radius:8px;padding:8px 10px}
  .kpi .l{font-size:10px;text-transform:uppercase;color:#666;letter-spacing:.04em}
  .kpi .v{font-size:16px;font-weight:800;margin-top:2px}
  table{width:100%;border-collapse:collapse;font-size:11px}
  th,td{border-bottom:1px solid #e5e5e5;padding:6px 8px;text-align:left;vertical-align:top}
  th{background:#f6f6f6;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#444}
  .mono{font-family:ui-monospace,Menlo,monospace;font-weight:700;font-size:10px}
  .b{font-weight:700}
  .sub{color:#777;font-size:10px}
  .pill{display:inline-block;padding:2px 6px;border-radius:999px;font-size:10px;font-weight:700;text-transform:capitalize}
  .pill-pago{background:#dcfce7;color:#166534}
  .pill-pendente{background:#fef3c7;color:#92400e}
  .pill-cancelado{background:#fee2e2;color:#991b1b}
  .footer{margin-top:18px;color:#888;font-size:10px;text-align:right}
  @media print{ @page{size:A4;margin:14mm} body{margin:0} thead{display:table-header-group} tr{page-break-inside:avoid} }
</style></head><body>
  <h1>Relatório de Palpites</h1>
  <div class="meta">
    <strong>Bolão:</strong> ${esc(bolaoLabel)} · <strong>Status:</strong> ${esc(statusLabel)} · <strong>Período:</strong> ${esc(periodo)}
    ${filters.search ? ` · <strong>Busca:</strong> ${esc(filters.search)}` : ""}
    <br/>Emitido em ${esc(new Date().toLocaleString("pt-BR"))}
  </div>
  <div class="grid">
    <div class="kpi"><div class="l">Palpites</div><div class="v">${totals.qtd}</div></div>
    <div class="kpi"><div class="l">Pagos</div><div class="v">${totals.qtdPagos}</div></div>
    <div class="kpi"><div class="l">Pendentes</div><div class="v">${totals.pendentes}</div></div>
    <div class="kpi"><div class="l">Cancelados</div><div class="v">${totals.cancelados}</div></div>
    <div class="kpi"><div class="l">Arrecadado</div><div class="v">${esc(brl(totals.arrecadado))}</div></div>
  </div>
  <table>
    <thead><tr><th>Protocolo</th><th>Torcedor</th><th>Bolão</th><th>Jogo</th><th>Palpite</th><th>Valor</th><th>Status</th><th>Data</th></tr></thead>
    <tbody>${linhas || `<tr><td colspan="8" style="text-align:center;color:#888;padding:24px">Nenhum palpite no filtro selecionado.</td></tr>`}</tbody>
  </table>
  <div class="footer">Gerado pelo sistema · ${esc(filtered.length)} registro(s)</div>
  <script>window.addEventListener('load',()=>{setTimeout(()=>window.print(),250)});</script>
</body></html>`;
    const w = window.open("", "_blank", "noopener,noreferrer");
    if (!w) {
      alert("Permita pop-ups para gerar o PDF.");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Palpites"
        subtitle="Gerencie pagamentos, envie mensagens e exporte relatórios profissionais."
        icon={<ListChecks className="h-5 w-5" />}
        actions={
          <>
            <button
              onClick={() => setShowFilters((v) => !v)}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-semibold hover:bg-accent/10"
            >
              <Filter className="h-4 w-4" /> Filtros
            </button>
            <button
              onClick={exportCsv}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-semibold hover:bg-accent/10"
            >
              <Download className="h-4 w-4" /> CSV
            </button>
            <button
              onClick={exportPdf}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-gradient-gold px-3 text-sm font-bold text-gold-foreground shadow-gold"
            >
              <FileText className="h-4 w-4" /> Relatório PDF
            </button>
          </>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard
          label="Palpites"
          value={String(totals.qtd)}
          icon={<ListChecks className="h-3.5 w-3.5" />}
        />
        <StatCard
          label="Pagos"
          value={String(totals.qtdPagos)}
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
          tone="success"
        />
        <StatCard
          label="Pendentes"
          value={String(totals.pendentes)}
          icon={<Clock className="h-3.5 w-3.5" />}
          tone="warn"
        />
        <StatCard
          label="Cancelados"
          value={String(totals.cancelados)}
          icon={<Ban className="h-3.5 w-3.5" />}
        />
        <StatCard
          label="Arrecadado"
          value={brl(totals.arrecadado)}
          icon={<DollarSign className="h-3.5 w-3.5" />}
          tone="success"
        />
      </div>

      {/* Quick search + status chips */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3 card-elevated">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por nome, WhatsApp ou protocolo…"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-2 text-sm"
          />
        </div>
        <div className="flex items-center gap-1 rounded-md bg-muted/40 p-1">
          {(["todos", "pendente", "pago", "cancelado"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilters({ ...filters, status: s })}
              className={`px-2.5 h-7 rounded text-xs font-semibold capitalize transition-colors ${
                filters.status === s
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {showFilters && (
        <div className="rounded-2xl border border-border bg-card p-4 grid gap-3 sm:grid-cols-4 card-elevated">
          <label className="text-xs font-semibold flex flex-col gap-1">
            Bolão
            <select
              value={filters.bolaoSlug}
              onChange={(e) => setFilters({ ...filters, bolaoSlug: e.target.value })}
              className="h-9 rounded-md border border-border bg-background px-2 text-sm font-normal"
            >
              <option value="todos">Todos</option>
              {boloesUnicos.map((b) => (
                <option key={b.slug} value={b.slug}>
                  {b.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold flex flex-col gap-1">
            De
            <input
              type="date"
              value={filters.dataDe}
              onChange={(e) => setFilters({ ...filters, dataDe: e.target.value })}
              className="h-9 rounded-md border border-border bg-background px-2 text-sm font-normal"
            />
          </label>
          <label className="text-xs font-semibold flex flex-col gap-1">
            Até
            <input
              type="date"
              value={filters.dataAte}
              onChange={(e) => setFilters({ ...filters, dataAte: e.target.value })}
              className="h-9 rounded-md border border-border bg-background px-2 text-sm font-normal"
            />
          </label>
          <div className="flex items-end">
            <button
              onClick={() =>
                setFilters({
                  status: "todos",
                  bolaoSlug: "todos",
                  search: "",
                  dataDe: "",
                  dataAte: "",
                })
              }
              className="h-9 w-full rounded-md border border-border text-xs font-semibold hover:bg-accent/10"
            >
              Limpar filtros
            </button>
          </div>
          <div className="sm:col-span-4 text-xs text-muted-foreground">
            Mostrando <strong className="text-foreground">{filtered.length}</strong> de{" "}
            {rows.length} palpites
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
          <ListChecks className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-2 text-sm text-muted-foreground">Nenhum palpite recebido ainda.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhum palpite corresponde aos filtros selecionados.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-x-auto card-elevated">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Protocolo</th>
                <th className="px-4 py-3">Torcedor</th>
                <th className="px-4 py-3">Jogo</th>
                <th className="px-4 py-3">Palpite</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-border hover:bg-muted/20 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs font-bold">
                    {fmtProtocolo(r.codigo)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.torcedores?.nome}</div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {r.torcedores?.whatsapp}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {teams.get(r.matches?.home_team_id ?? "") ?? "?"}{" "}
                    <span className="text-muted-foreground">x</span>{" "}
                    {teams.get(r.matches?.away_team_id ?? "") ?? "?"}
                  </td>
                  <td className="px-4 py-3 font-bold font-mono">
                    {r.palpite_a}–{r.palpite_b}
                  </td>
                  <td className="px-4 py-3 font-semibold">{brl(r.valor)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        r.status_pagamento === "pago"
                          ? "bg-green-600/15 text-green-700"
                          : r.status_pagamento === "cancelado"
                            ? "bg-red-600/15 text-red-700"
                            : "bg-amber-500/15 text-amber-700"
                      }`}
                    >
                      {r.status_pagamento}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      {r.status_pagamento !== "pago" && (
                        <button
                          onClick={() => aprovarEEnviar(r)}
                          className="inline-flex items-center gap-1 rounded-md bg-green-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-green-700"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Aprovar
                        </button>
                      )}
                      {r.status_pagamento === "pendente" && r.torcedores?.whatsapp && (
                        <button
                          onClick={() => lembrarPagamento(r)}
                          className="inline-flex items-center gap-1 rounded-md border border-amber-400 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                          title="Lembrar de enviar comprovante"
                        >
                          <MessageCircle className="h-3.5 w-3.5" /> Lembrar
                        </button>
                      )}
                      {r.status_pagamento === "pago" && r.torcedores?.whatsapp && (
                        <button
                          onClick={() => aprovarEEnviar(r)}
                          className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-semibold hover:bg-muted"
                          title="Reenviar recibo"
                        >
                          <MessageCircle className="h-3.5 w-3.5" /> Recibo
                        </button>
                      )}
                      {r.status_pagamento !== "cancelado" && (
                        <button
                          onClick={() => setStatus(r.id, "cancelado")}
                          className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Cancelar
                        </button>
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
  tone?: "default" | "success" | "warn";
}) {
  const color = tone === "success" ? "text-green-600" : tone === "warn" ? "text-amber-600" : "";
  return (
    <div className="rounded-xl border border-border bg-card p-3 card-elevated">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={`mt-1 text-xl font-black ${color}`}>{value}</div>
    </div>
  );
}
