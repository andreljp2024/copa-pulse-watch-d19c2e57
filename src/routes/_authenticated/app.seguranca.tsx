import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Shield, ShieldAlert, ShieldCheck, AlertTriangle, RefreshCw, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/seguranca")({
  head: () => ({ meta: [{ title: "Segurança & Antifraude" }] }),
  component: SegurancaPage,
});

type FraudRow = {
  torcedor_id: string;
  bolao_id: string;
  nome: string | null;
  whatsapp: string | null;
  total_palpites: number | null;
  pendentes: number | null;
  ultimos_10min: number | null;
  bloqueado: boolean | null;
  bolao_nome: string | null;
};

function maskWhats(w: string | null): string {
  if (!w) return "—";
  const d = w.replace(/\D/g, "").replace(/^55/, "");
  if (d.length < 10) return w;
  const ddd = d.slice(0, 2);
  const p1 = d.slice(2, d.length - 4);
  const p2 = d.slice(-4);
  return `(${ddd}) ${p1}-${p2}`;
}

function severity(r: FraudRow): { label: string; cls: string } {
  const u10 = r.ultimos_10min ?? 0;
  const pend = r.pendentes ?? 0;
  if (r.bloqueado) return { label: "Bloqueado", cls: "bg-destructive/20 text-destructive border-destructive/40" };
  if (u10 >= 20) return { label: "Crítico", cls: "bg-destructive/20 text-destructive border-destructive/40" };
  if (u10 >= 10 || pend >= 50) return { label: "Alto", cls: "bg-amber-500/20 text-amber-300 border-amber-500/40" };
  return { label: "Suspeito", cls: "bg-accent/20 text-accent border-accent/40" };
}

function SegurancaPage() {
  const qc = useQueryClient();
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["fraud_signals"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_fraud_signals");
      if (error) throw error;
      return (data ?? []) as FraudRow[];
    },
    refetchInterval: 30_000,
  });

  const toggle = useMutation({
    mutationFn: async ({ id, bloqueado }: { id: string; bloqueado: boolean }) => {
      const { error } = await supabase.rpc("set_torcedor_bloqueado", {
        p_torcedor_id: id,
        p_bloqueado: bloqueado,
      });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.bloqueado ? "Torcedor bloqueado" : "Torcedor desbloqueado");
      qc.invalidateQueries({ queryKey: ["fraud_signals"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = data ?? [];
  const criticos = rows.filter((r) => (r.ultimos_10min ?? 0) >= 20).length;
  const bloqueados = rows.filter((r) => r.bloqueado).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-black tracking-tight">Segurança & Antifraude</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Detecção automática de padrões suspeitos: alto volume em pouco tempo, muitos palpites
            pendentes ou comportamento fora do padrão. Bloqueie preventivamente quando necessário.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-border bg-card hover:bg-accent/10 text-sm font-semibold disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Atualizar
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi
          icon={<ShieldAlert className="h-4 w-4" />}
          label="Sinais ativos"
          value={rows.length}
          tone="accent"
        />
        <Kpi
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Críticos (≥20/10min)"
          value={criticos}
          tone="danger"
        />
        <Kpi
          icon={<Lock className="h-4 w-4" />}
          label="Bloqueados"
          value={bloqueados}
          tone="muted"
        />
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-border flex items-center gap-2">
          <Shield className="h-4 w-4 text-accent" />
          <h2 className="font-display font-bold text-sm">Torcedores sinalizados</h2>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center">
            <ShieldCheck className="h-10 w-10 text-accent mx-auto mb-3" />
            <p className="font-semibold">Tudo tranquilo por aqui</p>
            <p className="text-sm text-muted-foreground mt-1">
              Nenhum sinal de fraude nos seus bolões.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Torcedor</th>
                  <th className="text-left px-4 py-3 font-semibold">Bolão</th>
                  <th className="text-right px-4 py-3 font-semibold">Total</th>
                  <th className="text-right px-4 py-3 font-semibold">Pendentes</th>
                  <th className="text-right px-4 py-3 font-semibold">Últ. 10min</th>
                  <th className="text-left px-4 py-3 font-semibold">Nível</th>
                  <th className="text-right px-4 py-3 font-semibold">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => {
                  const sev = severity(r);
                  return (
                    <tr key={r.torcedor_id} className="hover:bg-accent/5">
                      <td className="px-4 py-3">
                        <div className="font-semibold">{r.nome ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{maskWhats(r.whatsapp)}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{r.bolao_nome ?? "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{r.total_palpites ?? 0}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{r.pendentes ?? 0}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-bold">
                        {r.ultimos_10min ?? 0}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-semibold ${sev.cls}`}
                        >
                          {sev.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          disabled={toggle.isPending}
                          onClick={() =>
                            toggle.mutate({ id: r.torcedor_id, bloqueado: !r.bloqueado })
                          }
                          className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-50 ${
                            r.bloqueado
                              ? "border-accent/40 text-accent hover:bg-accent/10"
                              : "border-destructive/40 text-destructive hover:bg-destructive/10"
                          }`}
                        >
                          {r.bloqueado ? (
                            <>
                              <Unlock className="h-3.5 w-3.5" /> Desbloquear
                            </>
                          ) : (
                            <>
                              <Lock className="h-3.5 w-3.5" /> Bloquear
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Critérios: mais de 20 palpites nos últimos 10 minutos, mais de 50 pendentes ou torcedor já
        bloqueado. Rate limit de 10 palpites/min por WhatsApp já é aplicado no backend.
      </p>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "accent" | "danger" | "muted";
}) {
  const toneCls =
    tone === "danger"
      ? "text-destructive"
      : tone === "accent"
        ? "text-accent"
        : "text-muted-foreground";
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className={`flex items-center gap-2 text-xs font-semibold ${toneCls}`}>
        {icon}
        <span className="uppercase tracking-wider">{label}</span>
      </div>
      <p className="mt-2 font-display text-3xl font-black tabular-nums">{value}</p>
    </div>
  );
}
