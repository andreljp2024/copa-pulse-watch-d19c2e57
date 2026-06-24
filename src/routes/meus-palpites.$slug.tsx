import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { brl, onlyDigits } from "@/lib/saas";
import { Search, Trophy, XCircle, Clock, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/meus-palpites/$slug")({
  component: MeusPalpitesPage,
  head: () => ({ meta: [{ title: "Meus palpites" }] }),
  errorComponent: ({ error }) => <div className="p-6 text-sm text-red-600">{error.message}</div>,
  notFoundComponent: () => <div className="p-6 text-sm">Bolão não encontrado.</div>,
});

type Row = {
  codigo: number;
  nome_torcedor: string;
  palpite_a: number;
  palpite_b: number;
  valor: number;
  status_pagamento: string;
  created_at: string;
  kickoff_at: string | null;
  home_team: string | null;
  away_team: string | null;
  placar_a: number | null;
  placar_b: number | null;
  match_status: string | null;
  ganhou: boolean;
};

function MeusPalpitesPage() {
  const { slug } = Route.useParams();
  const search = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const [whatsapp, setWhatsapp] = useState(search?.get("w") ?? "");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [bolaoNome, setBolaoNome] = useState<string>("");

  useEffect(() => {
    void supabase.from("boloes").select("nome").eq("slug", slug).maybeSingle().then(({ data }) => {
      if (data) setBolaoNome(data.nome as string);
    });
  }, [slug]);

  async function buscar(e?: React.FormEvent) {
    e?.preventDefault();
    const digits = onlyDigits(whatsapp);
    if (digits.length < 8) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("consultar_palpites_por_whatsapp", {
      p_slug: slug,
      p_whatsapp: digits,
    });
    setLoading(false);
    setSearched(true);
    if (error) {
      setRows([]);
      return;
    }
    setRows((data as Row[]) ?? []);
  }

  useEffect(() => {
    if (search?.get("w")) void buscar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ganhadores = rows?.filter((r) => r.ganhou) ?? [];
  const finalizados = rows?.filter((r) => r.match_status === "finished") ?? [];
  const semGanho = searched && rows && rows.length > 0 && ganhadores.length === 0 && finalizados.length > 0;

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-black">Meus palpites</h1>
        <p className="text-sm text-muted-foreground">{bolaoNome || "Consulte pelo seu WhatsApp"}</p>
      </header>

      <form onSubmit={buscar} className="flex gap-2">
        <input
          inputMode="tel"
          placeholder="DDD + número do WhatsApp"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          className="flex-1 h-11 rounded-lg border border-border bg-background px-3 text-sm"
        />
        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-11 items-center gap-1 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          <Search className="h-4 w-4" /> Buscar
        </button>
      </form>

      {loading && <p className="text-sm text-muted-foreground">Buscando…</p>}

      {searched && !loading && rows && rows.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <XCircle className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 font-semibold">Nenhum palpite encontrado</p>
          <p className="text-sm text-muted-foreground">Confira o número e tente novamente.</p>
        </div>
      )}

      {searched && rows && rows.length > 0 && (
        <div className="space-y-4">
          {ganhadores.length > 0 ? (
            <div className="rounded-xl border border-green-300 bg-green-50 p-4">
              <div className="flex items-center gap-2 font-bold text-green-800">
                <Trophy className="h-5 w-5" /> Parabéns! Você acertou {ganhadores.length} palpite(s).
              </div>
              <p className="text-sm text-green-900/80">Aguarde o contato do organizador.</p>
            </div>
          ) : semGanho ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
              <p className="font-bold text-amber-900">Não foi dessa vez 😔</p>
              <p className="text-sm text-amber-900/80">
                Você não acertou desta vez. Obrigado por participar — torcemos por você na próxima!
              </p>
            </div>
          ) : null}

          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.codigo} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-bold">BOL-{String(r.codigo).padStart(4, "0")}</span>
                  <StatusBadge r={r} />
                </div>
                <div className="mt-2 text-sm font-semibold">
                  {r.home_team ?? "?"} <span className="text-muted-foreground">x</span> {r.away_team ?? "?"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {r.kickoff_at ? new Date(r.kickoff_at).toLocaleString("pt-BR") : ""}
                </div>
                <div className="mt-2 flex items-center gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Seu palpite:</span>{" "}
                    <span className="font-bold">
                      {r.palpite_a} x {r.palpite_b}
                    </span>
                  </div>
                  {r.match_status === "finished" && r.placar_a !== null && r.placar_b !== null && (
                    <div>
                      <span className="text-muted-foreground">Placar:</span>{" "}
                      <span className="font-bold">
                        {r.placar_a} x {r.placar_b}
                      </span>
                    </div>
                  )}
                  <div className="ml-auto">{brl(r.valor)}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ r }: { r: Row }) {
  if (r.ganhou)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 font-semibold text-green-800">
        <Trophy className="h-3 w-3" /> Ganhou
      </span>
    );
  if (r.status_pagamento === "pago")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 font-semibold text-blue-800">
        <CheckCircle2 className="h-3 w-3" /> Pago
      </span>
    );
  if (r.status_pagamento === "cancelado")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 font-semibold text-red-800">
        <XCircle className="h-3 w-3" /> Cancelado
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">
      <Clock className="h-3 w-3" /> Pendente
    </span>
  );
}
