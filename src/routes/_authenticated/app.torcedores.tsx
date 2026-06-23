import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/torcedores")({
  component: TorcedoresPage,
});

type Torcedor = { id: string; nome: string; whatsapp: string; created_at: string };

function TorcedoresPage() {
  const [list, setList] = useState<Torcedor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data: t } = await supabase.from("tenants").select("id").eq("owner_user_id", u.user!.id).single(); if (!t) return;
      const { data } = await supabase.from("torcedores").select("id, nome, whatsapp, created_at").eq("tenant_id", t.id).order("created_at", { ascending: false });
      setList(data ?? []);
      setLoading(false);
    })();
  }, []);

  function exportCsv() {
    const rows = [["Nome", "WhatsApp", "Cadastro"], ...list.map((t) => [t.nome, t.whatsapp, new Date(t.created_at).toLocaleString("pt-BR")])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "torcedores.csv"; a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">Torcedores</h1>
        <button onClick={exportCsv} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-semibold"><Download className="h-4 w-4" /> Exportar CSV</button>
      </div>
      {loading ? <p className="text-sm text-muted-foreground">Carregando…</p> : list.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum torcedor cadastrado ainda. Compartilhe o link público do bolão.</p>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left"><tr><th className="px-4 py-2">Nome</th><th className="px-4 py-2">WhatsApp</th><th className="px-4 py-2">Cadastro</th></tr></thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="px-4 py-2 font-medium">{t.nome}</td>
                  <td className="px-4 py-2">{t.whatsapp}</td>
                  <td className="px-4 py-2 text-muted-foreground">{new Date(t.created_at).toLocaleString("pt-BR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
