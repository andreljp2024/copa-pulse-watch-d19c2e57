import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/saas";
import { CheckCircle2, XCircle, Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/palpites")({
  component: PalpitesPage,
});

type Row = {
  id: string;
  palpite_a: number;
  palpite_b: number;
  valor: number;
  status_pagamento: string;
  created_at: string;
  torcedores: { nome: string; whatsapp: string } | null;
  matches: { home_team_id: string | null; away_team_id: string | null; kickoff_at: string | null } | null;
};

function PalpitesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<Map<string, string>>(new Map());

  async function load() {
    const { data: u } = await supabase.auth.getUser();
    const { data: t } = await supabase.from("tenants").select("id").eq("owner_user_id", u.user!.id).single();
    const [{ data: pals }, { data: ts }] = await Promise.all([
      supabase.from("palpites").select("id, palpite_a, palpite_b, valor, status_pagamento, created_at, torcedores(nome, whatsapp), matches(home_team_id, away_team_id, kickoff_at)").eq("tenant_id", t.id).order("created_at", { ascending: false }),
      supabase.from("teams").select("id, name"),
    ]);
    setRows((pals as Row[]) ?? []);
    setTeams(new Map((ts ?? []).map((x) => [x.id, x.name])));
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  async function setStatus(id: string, status: string) {
    await supabase.from("palpites").update({ status_pagamento: status }).eq("id", id);
    void load();
  }

  function exportCsv() {
    const data = [
      ["Torcedor", "WhatsApp", "Jogo", "Palpite", "Valor", "Status", "Data"],
      ...rows.map((r) => [
        r.torcedores?.nome ?? "",
        r.torcedores?.whatsapp ?? "",
        `${teams.get(r.matches?.home_team_id ?? "") ?? "?"} x ${teams.get(r.matches?.away_team_id ?? "") ?? "?"}`,
        `${r.palpite_a} x ${r.palpite_b}`,
        brl(r.valor),
        r.status_pagamento,
        new Date(r.created_at).toLocaleString("pt-BR"),
      ]),
    ];
    const csv = data.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "palpites.csv"; a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">Palpites</h1>
        <button onClick={exportCsv} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-semibold"><Download className="h-4 w-4" /> Exportar CSV</button>
      </div>
      {loading ? <p className="text-sm text-muted-foreground">Carregando…</p> : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum palpite recebido.</p>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr><th className="px-4 py-2">Torcedor</th><th className="px-4 py-2">Jogo</th><th className="px-4 py-2">Palpite</th><th className="px-4 py-2">Valor</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Ações</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-2"><div className="font-medium">{r.torcedores?.nome}</div><div className="text-xs text-muted-foreground">{r.torcedores?.whatsapp}</div></td>
                  <td className="px-4 py-2">{teams.get(r.matches?.home_team_id ?? "") ?? "?"} <span className="text-muted-foreground">x</span> {teams.get(r.matches?.away_team_id ?? "") ?? "?"}</td>
                  <td className="px-4 py-2 font-bold">{r.palpite_a} x {r.palpite_b}</td>
                  <td className="px-4 py-2">{brl(r.valor)}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.status_pagamento === "pago" ? "bg-green-100 text-green-800" : r.status_pagamento === "cancelado" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>{r.status_pagamento}</span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1">
                      {r.status_pagamento !== "pago" && <button onClick={() => setStatus(r.id, "pago")} className="text-green-700 hover:underline text-xs inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" />Pago</button>}
                      {r.status_pagamento !== "cancelado" && <button onClick={() => setStatus(r.id, "cancelado")} className="text-red-700 hover:underline text-xs inline-flex items-center gap-1"><XCircle className="h-3.5 w-3.5" />Cancelar</button>}
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
