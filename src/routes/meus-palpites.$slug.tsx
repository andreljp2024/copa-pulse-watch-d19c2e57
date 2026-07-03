import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { brl, onlyDigits } from "@/lib/saas";
import { Search, Trophy, XCircle, Clock, CheckCircle2, Sparkles, Bell, BellOff } from "lucide-react";
import { formatBR } from "@/lib/timezone";
import { pushSupported, subscribePush, unsubscribePush } from "@/lib/push";

export const Route = createFileRoute("/meus-palpites/$slug")({
  component: MeusPalpitesPage,
  head: () => ({ meta: [{ title: "Meus palpites" }] }),
  errorComponent: ({ error }) => (
    <div className="p-6 text-sm text-destructive">{error.message}</div>
  ),
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
  home_flag: string | null;
  away_flag: string | null;
  placar_a: number | null;
  placar_b: number | null;
  match_status: string | null;
  ganhou: boolean;
};

function TeamBadge({ name, flag }: { name: string | null; flag: string | null }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {flag ? (
        <img
          src={flag}
          alt=""
          className="h-5 w-7 rounded-sm object-cover ring-1 ring-border"
          loading="lazy"
        />
      ) : null}
      <span>{name ?? "?"}</span>
    </span>
  );
}

function MeusPalpitesPage() {
  const { slug } = Route.useParams();
  const [whatsapp, setWhatsapp] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [bolaoNome, setBolaoNome] = useState<string>("");

  // Hidrata o valor de ?w= somente após o mount, evitando mismatch SSR/CSR.
  useEffect(() => {
    const w = new URLSearchParams(window.location.search).get("w");
    if (w) setWhatsapp(w);
  }, []);


  useEffect(() => {
    void supabase
      .from("boloes")
      .select("nome")
      .eq("slug", slug)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setBolaoNome(data.nome as string);
      });
  }, [slug]);

  async function buscar(e?: React.FormEvent | string) {
    let source: string;
    if (typeof e === "string") {
      source = e;
    } else {
      e?.preventDefault?.();
      source = whatsapp;
    }
    const digits = onlyDigits(source);
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
    const w = new URLSearchParams(window.location.search).get("w");
    if (w) void buscar(w);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ganhadores = rows?.filter((r) => r.ganhou) ?? [];
  const finalizados = rows?.filter((r) => r.match_status === "finished") ?? [];
  const semGanho =
    searched && rows && rows.length > 0 && ganhadores.length === 0 && finalizados.length > 0;

  return (
    <div className="min-h-screen bg-hero relative overflow-hidden">
      {/* Brazilian flag accent stripes */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-samba" />
      <div className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />

      <div className="relative mx-auto max-w-2xl p-6 space-y-6">
        <header className="text-center pt-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-card/60 backdrop-blur px-3 py-1 text-xs font-semibold text-accent">
            <Sparkles className="h-3 w-3" /> Espírito de torcedor 🇧🇷
          </div>
          <h1 className="mt-3 text-4xl font-display font-black text-gradient-samba">
            Meus palpites
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {bolaoNome ? `${bolaoNome} • Consulta pelo WhatsApp` : "Consulte pelo seu WhatsApp"}
          </p>
        </header>

        <form
          onSubmit={buscar}
          className="ring-conic rounded-2xl bg-gradient-card backdrop-blur p-2 flex gap-2 card-elevated"
        >
          <input
            inputMode="tel"
            placeholder="DDD + número do WhatsApp"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            className="flex-1 h-12 rounded-xl bg-background/60 border border-border px-4 text-sm outline-none focus:border-accent transition-colors"
          />
          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-12 items-center gap-2 rounded-xl bg-gradient-gold px-5 text-sm font-bold text-black shadow-gold disabled:opacity-50 hover:scale-[1.02] transition-transform"
          >
            <Search className="h-4 w-4" /> Buscar
          </button>
        </form>

        {loading && (
          <p className="text-center text-sm text-muted-foreground animate-pulse">
            Buscando seus palpites…
          </p>
        )}

        {searched && !loading && rows && rows.length === 0 && (
          <div className="rounded-2xl border border-border bg-gradient-card backdrop-blur p-8 text-center card-elevated">
            <XCircle className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 font-display font-bold text-lg">Nenhum palpite encontrado</p>
            <p className="text-sm text-muted-foreground">Confira o número e tente novamente.</p>
          </div>
        )}

        {searched && rows && rows.length > 0 && (
          <div className="space-y-4">
            {ganhadores.length > 0 ? (
              <div className="relative overflow-hidden rounded-2xl border border-accent/40 bg-gradient-gold p-6 shadow-gold">
                <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/20 blur-2xl" />
                <div className="relative flex items-center gap-3 font-display text-2xl font-black text-black">
                  <Trophy className="h-7 w-7" /> GOOOL! 🏆 🇧🇷
                </div>
                <p className="relative mt-2 font-semibold text-black">
                  Parabéns, torcedor! Você acertou {ganhadores.length} palpite(s).
                </p>
                <p className="relative text-sm text-black/80">
                  Aguarde o contato do organizador para receber seu prêmio.
                </p>
              </div>
            ) : semGanho ? (
              <div className="rounded-2xl border border-destructive/30 bg-gradient-card backdrop-blur p-6 card-elevated">
                <p className="font-display text-xl font-black text-foreground">
                  Não foi dessa vez 💚💛
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Você não acertou desta vez. Obrigado por vestir a camisa — a torcida continua, e a
                  próxima é nossa!
                </p>
              </div>
            ) : null}

            <ul className="space-y-3">
              {rows.map((r) => (
                <li
                  key={r.codigo}
                  className="group relative overflow-hidden rounded-2xl border border-border bg-gradient-card backdrop-blur p-4 card-elevated hover:border-accent/40 transition-colors"
                >
                  <span className="absolute left-0 top-0 h-full w-1 bg-gradient-samba" />
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-accent">
                      BOL-{String(r.codigo).padStart(4, "0")}
                    </span>
                    <StatusBadge r={r} />
                  </div>
                  <div className="mt-2 font-display text-base font-bold flex items-center gap-2 flex-wrap">
                    <TeamBadge name={r.home_team} flag={r.home_flag} />
                    <span className="text-muted-foreground font-normal">x</span>
                    <TeamBadge name={r.away_team} flag={r.away_flag} />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {r.kickoff_at ? formatBR(r.kickoff_at) : ""}
                  </div>
                  <div className="mt-3 flex items-center gap-4 text-sm flex-wrap">
                    <div className="rounded-lg bg-background/60 px-3 py-1.5 border border-border">
                      <span className="text-muted-foreground text-xs">Palpite:</span>{" "}
                      <span className="font-display font-black text-base">
                        {r.palpite_a} <span className="text-muted-foreground">x</span> {r.palpite_b}
                      </span>
                    </div>
                    {r.match_status === "finished" &&
                      r.placar_a !== null &&
                      r.placar_b !== null && (
                        <div className="rounded-lg bg-accent/10 px-3 py-1.5 border border-accent/30">
                          <span className="text-muted-foreground text-xs">Placar:</span>{" "}
                          <span className="font-display font-black text-base text-accent">
                            {r.placar_a} <span className="opacity-70">x</span> {r.placar_b}
                          </span>
                        </div>
                      )}
                    <div className="ml-auto font-semibold text-primary">{brl(r.valor)}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <footer className="pt-4 text-center text-xs text-muted-foreground">
          Feito com 💚💛 para o torcedor brasileiro
        </footer>
      </div>
    </div>
  );
}

function StatusBadge({ r }: { r: Row }) {
  if (r.ganhou)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gradient-gold px-2.5 py-0.5 font-bold text-black shadow-gold">
        <Trophy className="h-3 w-3" /> Ganhou
      </span>
    );
  if (r.status_pagamento === "pago")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary/20 border border-primary/40 px-2.5 py-0.5 font-semibold text-primary">
        <CheckCircle2 className="h-3 w-3" /> Pago
      </span>
    );
  if (r.status_pagamento === "cancelado")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/20 border border-destructive/40 px-2.5 py-0.5 font-semibold text-destructive">
        <XCircle className="h-3 w-3" /> Cancelado
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent/20 border border-accent/40 px-2.5 py-0.5 font-semibold text-accent">
      <Clock className="h-3 w-3" /> Pendente
    </span>
  );
}
