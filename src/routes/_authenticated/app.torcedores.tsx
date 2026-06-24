import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Download, Search, MessageCircle, Users } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";


export const Route = createFileRoute("/_authenticated/app/torcedores")({
  component: TorcedoresPage,
});

type Lead = {
  palpite_id: string;
  torcedor_id: string;
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
};

function TorcedoresPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data: t } = await supabase.from("tenants").select("id").eq("owner_user_id", u.user!.id).single();
      if (!t) { setLoading(false); return; }

      const { data: palpites } = await supabase
        .from("palpites")
        .select("id, torcedor_id, match_id, valor, palpite_a, palpite_b, created_at")
        .eq("tenant_id", t.id)
        .order("created_at", { ascending: false });

      const torcedorIds = Array.from(new Set((palpites ?? []).map((p) => p.torcedor_id)));
      const matchIds = Array.from(new Set((palpites ?? []).map((p) => p.match_id)));

      const [torcRes, matchRes] = await Promise.all([
        torcedorIds.length ? supabase.from("torcedores").select("id, nome, whatsapp").in("id", torcedorIds) : Promise.resolve({ data: [] as any[] }),
        matchIds.length ? supabase.from("matches").select("id, kickoff_at, home_team_id, away_team_id").in("id", matchIds) : Promise.resolve({ data: [] as any[] }),
      ]);
      const teamIds = Array.from(new Set((matchRes.data ?? []).flatMap((m: any) => [m.home_team_id, m.away_team_id])));
      const teamRes = teamIds.length ? await supabase.from("teams").select("id, name, flag_url").in("id", teamIds) : { data: [] as any[] };

      const torcMap = new Map((torcRes.data ?? []).map((x: any) => [x.id, x]));
      const matchMap = new Map((matchRes.data ?? []).map((x: any) => [x.id, x]));
      const teamMap = new Map((teamRes.data ?? []).map((x: any) => [x.id, x]));

      const out: Lead[] = (palpites ?? []).map((p) => {
        const tor = torcMap.get(p.torcedor_id);
        const m = matchMap.get(p.match_id);
        const home = m ? teamMap.get(m.home_team_id) : null;
        const away = m ? teamMap.get(m.away_team_id) : null;
        return {
          palpite_id: p.id,
          torcedor_id: p.torcedor_id,
          nome: tor?.nome ?? "—",
          whatsapp: tor?.whatsapp ?? "",
          valor: Number(p.valor ?? 0),
          palpite_a: p.palpite_a,
          palpite_b: p.palpite_b,
          created_at: p.created_at,
          match_id: p.match_id,
          kickoff_at: m?.kickoff_at ?? "",
          home: home?.name ?? "?",
          away: away?.name ?? "?",
          home_flag: home?.flag_url ?? null,
          away_flag: away?.flag_url ?? null,
        };
      });
      setLeads(out);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return leads;
    return leads.filter((l) =>
      l.nome.toLowerCase().includes(s) ||
      l.whatsapp.toLowerCase().includes(s) ||
      l.home.toLowerCase().includes(s) ||
      l.away.toLowerCase().includes(s),
    );
  }, [leads, q]);

  const totals = useMemo(() => {
    const uniques = new Set(filtered.map((l) => l.torcedor_id)).size;
    const valor = filtered.reduce((s, l) => s + l.valor, 0);
    return { leads: filtered.length, uniques, valor };
  }, [filtered]);

  function exportCsv() {
    const rows = [
      ["Nome", "WhatsApp", "Jogo", "Data do jogo", "Palpite", "Valor (R$)", "Cadastro"],
      ...filtered.map((l) => [
        l.nome,
        l.whatsapp,
        `${l.home} x ${l.away}`,
        l.kickoff_at ? new Date(l.kickoff_at).toLocaleString("pt-BR") : "",
        `${l.palpite_a}-${l.palpite_b}`,
        l.valor.toFixed(2),
        new Date(l.created_at).toLocaleString("pt-BR"),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "leads-torcedores.csv"; a.click(); URL.revokeObjectURL(url);
  }

  function waLink(whats: string, nome: string, home: string, away: string) {
    const digits = whats.replace(/\D/g, "");
    const msg = `Olá ${nome.split(" ")[0]}! Obrigado pelo palpite em ${home} x ${away}. 🍀`;
    return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-black">Leads de torcedores</h1>
          <p className="text-sm text-muted-foreground">Cada palpite é um lead — nome, WhatsApp, jogo, data e valor da aposta.</p>
        </div>
        <button onClick={exportCsv} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-semibold"><Download className="h-4 w-4" /> Exportar CSV</button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Leads" value={String(totals.leads)} />
        <StatCard label="Torcedores únicos" value={String(totals.uniques)} icon={<Users className="h-4 w-4" />} />
        <StatCard label="Total apostado" value={`R$ ${totals.valor.toFixed(2)}`} />
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, WhatsApp ou time..." className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-pitch/40" />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum lead ainda. Compartilhe o link público do bolão.</p>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase">
              <tr>
                <th className="px-4 py-2">Nome</th>
                <th className="px-4 py-2">WhatsApp</th>
                <th className="px-4 py-2">Jogo</th>
                <th className="px-4 py-2">Data do jogo</th>
                <th className="px-4 py-2">Palpite</th>
                <th className="px-4 py-2 text-right">Valor</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.palpite_id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-4 py-2 font-medium">{l.nome}</td>
                  <td className="px-4 py-2 text-muted-foreground">{l.whatsapp}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      {l.home_flag && <img src={l.home_flag} alt="" className="h-4 w-6 object-cover rounded-sm ring-1 ring-border" />}
                      <span className="font-medium">{l.home}</span>
                      <span className="text-muted-foreground">x</span>
                      <span className="font-medium">{l.away}</span>
                      {l.away_flag && <img src={l.away_flag} alt="" className="h-4 w-6 object-cover rounded-sm ring-1 ring-border" />}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{l.kickoff_at ? new Date(l.kickoff_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                  <td className="px-4 py-2 font-mono">{l.palpite_a}–{l.palpite_b}</td>
                  <td className="px-4 py-2 text-right font-semibold">R$ {l.valor.toFixed(2)}</td>
                  <td className="px-4 py-2">
                    {l.whatsapp && (
                      <a href={waLink(l.whatsapp, l.nome, l.home, l.away)} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1 rounded-md bg-green-600 px-2 text-xs font-semibold text-white">
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

function StatCard({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 text-xl font-black">{value}</div>
    </div>
  );
}
