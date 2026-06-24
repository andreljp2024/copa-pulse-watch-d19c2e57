import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { brl, buildWhatsAppLink } from "@/lib/saas";
import { CheckCircle2, XCircle, Download, MessageCircle, FileText, Filter } from "lucide-react";

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
  matches: { home_team_id: string | null; away_team_id: string | null; kickoff_at: string | null } | null;
  boloes: { nome: string; slug: string } | null;
};

function fmtProtocolo(c: number | null) {
  return c ? `BOL-${String(c).padStart(4, "0")}` : "—";
}

function PalpitesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<Map<string, string>>(new Map());
  const [filters, setFilters] = useState({
    status: "todos", bolaoSlug: "todos", search: "", dataDe: "", dataAte: "",
  });
  const [showFilters, setShowFilters] = useState(false);

  

  async function load() {
    const { data: u } = await supabase.auth.getUser();
    const { data: t } = await supabase.from("tenants").select("id").eq("owner_user_id", u.user!.id).single();
    if (!t) return;
    const [{ data: pals }, { data: ts }] = await Promise.all([
      supabase
        .from("palpites")
        .select(
          "id, codigo, bolao_id, palpite_a, palpite_b, valor, status_pagamento, created_at, torcedores(nome, whatsapp), matches(home_team_id, away_team_id, kickoff_at), boloes(nome, slug)",
        )
        .eq("tenant_id", t.id)
        .order("created_at", { ascending: false }),
      supabase.from("teams").select("id, name"),
    ]);
    setRows(((pals as unknown) as Row[]) ?? []);
    setTeams(new Map((ts ?? []).map((x) => [x.id, x.name])));
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);

  async function setStatus(id: string, status: string) {
    await supabase.from("palpites").update({ status_pagamento: status }).eq("id", id);
    void load();
  }

  function aprovarEEnviar(r: Row) {
    const home = teams.get(r.matches?.home_team_id ?? "") ?? "?";
    const away = teams.get(r.matches?.away_team_id ?? "") ?? "?";
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
    const home = teams.get(r.matches?.home_team_id ?? "") ?? "?";
    const away = teams.get(r.matches?.away_team_id ?? "") ?? "?";
    const protocolo = fmtProtocolo(r.codigo);
    const kickoff = r.matches?.kickoff_at
      ? new Date(r.matches.kickoff_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
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

  function exportCsv() {
    const data = [
      ["Protocolo", "Torcedor", "WhatsApp", "Jogo", "Palpite", "Valor", "Status", "Data"],
      ...rows.map((r) => [
        fmtProtocolo(r.codigo),
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
    const a = document.createElement("a");
    a.href = url;
    a.download = "palpites.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">Palpites</h1>
        <button onClick={exportCsv} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-semibold">
          <Download className="h-4 w-4" /> Exportar CSV
        </button>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum palpite recebido.</p>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-2">Protocolo</th>
                <th className="px-4 py-2">Torcedor</th>
                <th className="px-4 py-2">Jogo</th>
                <th className="px-4 py-2">Palpite</th>
                <th className="px-4 py-2">Valor</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-2 font-mono text-xs font-bold">{fmtProtocolo(r.codigo)}</td>
                  <td className="px-4 py-2">
                    <div className="font-medium">{r.torcedores?.nome}</div>
                    <div className="text-xs text-muted-foreground">{r.torcedores?.whatsapp}</div>
                  </td>
                  <td className="px-4 py-2">
                    {teams.get(r.matches?.home_team_id ?? "") ?? "?"} <span className="text-muted-foreground">x</span>{" "}
                    {teams.get(r.matches?.away_team_id ?? "") ?? "?"}
                  </td>
                  <td className="px-4 py-2 font-bold">
                    {r.palpite_a} x {r.palpite_b}
                  </td>
                  <td className="px-4 py-2">{brl(r.valor)}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        r.status_pagamento === "pago"
                          ? "bg-green-100 text-green-800"
                          : r.status_pagamento === "cancelado"
                          ? "bg-red-100 text-red-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {r.status_pagamento}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-2">
                      {r.status_pagamento !== "pago" && (
                        <button
                          onClick={() => aprovarEEnviar(r)}
                          className="inline-flex items-center gap-1 rounded-md bg-green-600 px-2 py-1 text-xs font-semibold text-white hover:bg-green-700"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Aprovar
                          <MessageCircle className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {r.status_pagamento === "pendente" && r.torcedores?.whatsapp && (
                        <button
                          onClick={() => lembrarPagamento(r)}
                          className="inline-flex items-center gap-1 rounded-md border border-amber-400 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                          title="Lembrar de enviar comprovante"
                        >
                          <MessageCircle className="h-3.5 w-3.5" /> Lembrar
                        </button>
                      )}
                      {r.status_pagamento === "pago" && r.torcedores?.whatsapp && (
                        <button
                          onClick={() => aprovarEEnviar(r)}
                          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-semibold hover:bg-muted"
                          title="Reenviar recibo"
                        >
                          <MessageCircle className="h-3.5 w-3.5" /> Recibo
                        </button>
                      )}
                      {r.status_pagamento !== "cancelado" && (
                        <button onClick={() => setStatus(r.id, "cancelado")} className="text-red-700 hover:underline text-xs inline-flex items-center gap-1">
                          <XCircle className="h-3.5 w-3.5" />
                          Cancelar
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
