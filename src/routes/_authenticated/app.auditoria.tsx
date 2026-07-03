import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRFull } from "@/lib/timezone";
import { toast } from "sonner";
import { Shield, Download, RefreshCw, FileText, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/auditoria")({
  head: () => ({ meta: [{ title: "Auditoria e Backup" }] }),
  component: AuditoriaPage,
});

type AuditRow = {
  id: string;
  tenant_id: string | null;
  actor_email: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  before: unknown;
  after: unknown;
  meta: unknown;
  created_at: string;
};

type BolaoRow = { id: string; nome: string; slug: string };

const ACTION_STYLE: Record<string, string> = {
  INSERT: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  UPDATE: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  DELETE: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  EXPORT: "bg-sky-500/15 text-sky-400 border-sky-500/30",
};

function AuditoriaPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [boloes, setBoloes] = useState<BolaoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  async function load() {
    setLoading(true);
    const [{ data: audit, error: err1 }, { data: bs, error: err2 }] = await Promise.all([
      supabase.rpc("list_audit_log", { p_limit: 200, p_offset: 0 }),
      supabase.from("boloes").select("id, nome, slug").order("created_at", { ascending: false }),
    ]);
    if (err1) toast.error("Falha ao carregar auditoria");
    if (err2) toast.error("Falha ao carregar bolões");
    setRows((audit ?? []) as AuditRow[]);
    setBoloes((bs ?? []) as BolaoRow[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.entity.toLowerCase().includes(q) ||
        r.action.toLowerCase().includes(q) ||
        (r.actor_email ?? "").toLowerCase().includes(q) ||
        (r.entity_id ?? "").toLowerCase().includes(q),
    );
  }, [rows, filter]);

  async function baixarBackup(b: BolaoRow) {
    setExportingId(b.id);
    try {
      const { data, error } = await supabase.rpc("export_bolao", { p_bolao_id: b.id });
      if (error) throw error;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-${b.slug}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Backup baixado. Guarde em local seguro.");
      load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao exportar";
      toast.error(msg);
    } finally {
      setExportingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-samba shadow-glow">
          <Shield className="h-5 w-5 text-gold-foreground" />
        </div>
        <div className="min-w-0">
          <h1 className="font-display font-black text-2xl tracking-tight">Auditoria e Backup</h1>
          <p className="text-sm text-muted-foreground">
            Rastreabilidade completa das ações e exportação de bolões em JSON.
          </p>
        </div>
      </header>

      {/* Backup */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-primary" />
            <h2 className="font-display font-bold">Backup de bolão</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Inclui bolão, jogos vinculados, torcedores, palpites e ganhadores.
          </p>
        </div>
        {boloes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum bolão para exportar.</p>
        ) : (
          <ul className="space-y-2">
            {boloes.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-semibold truncate">{b.nome}</p>
                  <p className="text-xs text-muted-foreground truncate">/{b.slug}</p>
                </div>
                <button
                  onClick={() => baixarBackup(b)}
                  disabled={exportingId === b.id}
                  className="inline-flex items-center gap-2 h-9 px-3 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {exportingId === b.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  Baixar JSON
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[11px] text-muted-foreground">
          Restauração é feita sob demanda pelo dev responsável para preservar integridade referencial.
        </p>
      </section>

      {/* Auditoria */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4 gap-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <h2 className="font-display font-bold">Registro de ações (últimas 200)</h2>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filtrar por entidade, ação, e-mail…"
              className="h-9 px-3 rounded-lg bg-background border border-border text-sm w-64"
            />
            <button
              onClick={load}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold border border-border hover:bg-accent/10"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Atualizar
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" /> Carregando…
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum registro encontrado.
          </p>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="py-2 px-2">Quando</th>
                  <th className="py-2 px-2">Ator</th>
                  <th className="py-2 px-2">Ação</th>
                  <th className="py-2 px-2">Entidade</th>
                  <th className="py-2 px-2">ID</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-border/40 hover:bg-accent/5">
                    <td className="py-2 px-2 whitespace-nowrap text-muted-foreground">
                      {formatDateTimeBR(r.created_at)}
                    </td>
                    <td className="py-2 px-2 truncate max-w-[220px]">
                      {r.actor_email ?? <span className="text-muted-foreground">sistema</span>}
                    </td>
                    <td className="py-2 px-2">
                      <span
                        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold ${
                          ACTION_STYLE[r.action] ?? "bg-muted text-foreground border-border"
                        }`}
                      >
                        {r.action}
                      </span>
                    </td>
                    <td className="py-2 px-2 font-mono text-xs">{r.entity}</td>
                    <td className="py-2 px-2 font-mono text-[11px] text-muted-foreground truncate max-w-[180px]">
                      {r.entity_id}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
