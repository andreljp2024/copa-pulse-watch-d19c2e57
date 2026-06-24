import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import confetti from "canvas-confetti";
import { supabase } from "@/integrations/supabase/client";
import { brl, buildWhatsAppLink, interpolate, onlyDigits } from "@/lib/saas";
import { buildPixPayload } from "@/lib/pix";
import { Trophy, MessageCircle, Loader2, Copy, Check, ListOrdered } from "lucide-react";

type Match = {
  id: string;
  home_team_id: string | null;
  away_team_id: string | null;
  kickoff_at: string | null;
  status: string;
  home_score: number | null;
  away_score: number | null;
};

type TeamLite = { name: string; code: string; flag_url: string | null };

const bolaoPublicOpts = (slug: string) =>
  queryOptions({
    queryKey: ["bolao", slug, "public"],
    queryFn: async () => {
      const { data: bolao, error } = await supabase
        .from("boloes")
        .select("*")
        .eq("slug", slug)
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      if (!bolao) throw notFound();

      const [m, t, p, w] = await Promise.all([
        supabase
          .from("matches")
          .select("id, home_team_id, away_team_id, kickoff_at, status, home_score, away_score")
          .order("kickoff_at", { ascending: true }),
        supabase.from("teams").select("id, name, code, flag_url"),
        supabase
          .from("tenant_pix_config")
          .select("nome_recebedor, chave_pix, banco, valor_padrao_palpite")
          .eq("tenant_id", bolao.tenant_id)
          .maybeSingle(),
        supabase
          .from("tenant_whatsapp_config")
          .select("numero_whatsapp, mensagem_novo_palpite")
          .eq("tenant_id", bolao.tenant_id)
          .maybeSingle(),
      ]);

      return {
        bolao,
        matches: (m.data ?? []) as Match[],
        teams: new Map<string, TeamLite>(
          (t.data ?? []).map((x) => [x.id, { name: x.name, code: x.code, flag_url: x.flag_url }]),
        ),
        pix: p.data
          ? { ...p.data, valor_padrao_palpite: Number(p.data.valor_padrao_palpite) }
          : null,
        wa: w.data,
      };
    },
    staleTime: 30_000,
  });

export const Route = createFileRoute("/bolao/$slug")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(bolaoPublicOpts(params.slug)),
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.bolao.nome} — Bolão Copa 2026` },
          { name: "description", content: loaderData.bolao.descricao ?? `Participe do ${loaderData.bolao.nome}.` },
          { property: "og:title", content: loaderData.bolao.nome },
          { property: "og:description", content: loaderData.bolao.descricao ?? "Faça seu palpite e concorra." },
          ...(loaderData.bolao.logo_url ? [{ property: "og:image", content: loaderData.bolao.logo_url }] : []),
        ]
      : [],
  }),
  component: PublicBolao,
  errorComponent: ({ error }) => (
    <div className="min-h-screen grid place-items-center p-8 text-center">
      <div>
        <h1 className="text-2xl font-bold">Não foi possível carregar o bolão</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <Link to="/" className="mt-4 inline-block text-pitch font-semibold">Voltar</Link>
      </div>
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center p-8 text-center">
      <div>
        <h1 className="text-3xl font-black">Bolão não encontrado</h1>
        <Link to="/" className="mt-4 inline-block text-pitch font-semibold">Voltar</Link>
      </div>
    </div>
  ),
});

function PublicBolao() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(bolaoPublicOpts(slug));
  const { bolao, matches, teams, pix, wa } = data;
  const [selected, setSelected] = useState<Match | null>(null);
  const [form, setForm] = useState({ nome: "", whatsapp: "", palpite_a: 0, palpite_b: 0 });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ link: string; protocolo: string } | null>(null);


  const palpiteAberto = useMemo(() => {
    if (!bolao.data_limite_palpite) return true;
    return new Date(bolao.data_limite_palpite) > new Date();
  }, [bolao.data_limite_palpite]);

  async function submitPalpite(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !wa || !pix) return;
    const whatsapp = onlyDigits(form.whatsapp);
    if (whatsapp.length < 10) {
      alert("Informe um WhatsApp válido com DDD.");
      return;
    }
    setSubmitting(true);
    try {
      const { data: rData, error: rErr } = await supabase.rpc("submit_palpite", {
        p_bolao_id: bolao.id,
        p_nome: form.nome.trim(),
        p_whatsapp: whatsapp,
        p_match_id: selected.id,
        p_palpite_a: form.palpite_a,
        p_palpite_b: form.palpite_b,
      });
      if (rErr) throw rErr;
      const protocolo = Array.isArray(rData) && rData[0]?.codigo
        ? `BOL-${String(rData[0].codigo).padStart(4, "0")}`
        : "—";
      const home = teams.get(selected.home_team_id ?? "");
      const away = teams.get(selected.away_team_id ?? "");
      const msg = interpolate(wa.mensagem_novo_palpite ?? "", {
        nome_bolao: bolao.nome,
        nome_torcedor: form.nome,
        whatsapp_torcedor: whatsapp,
        selecao_a: home?.name ?? "",
        selecao_b: away?.name ?? "",
        palpite_a: form.palpite_a,
        palpite_b: form.palpite_b,
        valor_palpite: brl(bolao.valor_palpite),
        nome_recebedor: pix.nome_recebedor,
        banco: pix.banco ?? "",
        chave_pix: pix.chave_pix,
        protocolo,
      }) + `\n\nProtocolo: ${protocolo}`;
      setDone({ link: buildWhatsAppLink(wa.numero_whatsapp, msg), protocolo });

      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao enviar palpite");
    } finally {
      setSubmitting(false);
    }
  }


  return (
    <div className="min-h-screen bg-background text-foreground">
      <header
        className="relative overflow-hidden bg-hero grain border-b border-border"
        style={bolao.cor_primaria ? ({ ["--brand-tint" as any]: bolao.cor_primaria } as React.CSSProperties) : undefined}
      >
        {/* Conic samba glow */}
        <div
          aria-hidden="true"
          className="absolute -top-32 -right-32 h-[28rem] w-[28rem] rounded-full opacity-25 blur-3xl animate-spin-slow pointer-events-none"
          style={{ backgroundImage: "var(--gradient-conic-gold)" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-background/40 to-background pointer-events-none" aria-hidden="true" />

        <div className="relative mx-auto max-w-5xl px-4 py-10 sm:py-14 flex items-center gap-5">
          <div className="ring-conic rounded-2xl">
            {bolao.logo_url ? (
              <img src={bolao.logo_url} alt="" className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl object-cover bg-card" />
            ) : (
              <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-gradient-samba grid place-items-center shadow-gold">
                <Trophy className="h-8 w-8 text-gold-foreground" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-card/40 backdrop-blur px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-gold mb-2">
              <span className="h-1.5 w-1.5 rounded-full bg-gradient-samba animate-pulse" />
              Vai, Brasil! · Copa 2026
            </div>
            <h1 className="font-display text-3xl sm:text-5xl font-black uppercase leading-[0.95] bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text text-transparent">
              {bolao.nome}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Valor do palpite: <span className="font-semibold text-gold">{brl(bolao.valor_palpite)}</span>
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 pt-4">
        <Link to="/bolao/$slug/ranking" params={{ slug: bolao.slug }} className="inline-flex items-center gap-2 text-sm font-semibold text-gold hover:underline">
          <ListOrdered className="h-4 w-4" /> Ver ranking
        </Link>
      </div>



      <main className="mx-auto max-w-5xl px-4 py-8 space-y-8">
        {bolao.regras && (
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-bold mb-2">Regras</h2>
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">{bolao.regras}</p>
          </section>
        )}

        <section>
          <h2 className="font-display text-2xl sm:text-3xl font-black uppercase tracking-wide mb-4 flex items-center gap-3">
            <span className="inline-block h-6 w-1 bg-gradient-samba rounded-sm" aria-hidden="true" />
            Jogos
          </h2>
          {!palpiteAberto && (
            <p className="mb-3 text-sm font-semibold text-live bg-live/10 border border-live/30 rounded-lg p-3">
              ⏰ Período de palpites encerrado.
            </p>
          )}
          <div className="grid gap-2">
            {matches.slice(0, 30).map((m) => {
              const home = teams.get(m.home_team_id ?? "");
              const away = teams.get(m.away_team_id ?? "");
              return (
                <div key={m.id} className="rounded-xl border border-border bg-gradient-card p-3 flex items-center gap-3 card-elevated transition-colors hover:border-gold/40">
                  <div className="flex-1 flex items-center gap-2">
                    {home?.flag_url && <img src={home.flag_url} alt="" className="h-5 w-7 object-cover rounded" />}
                    <span className="font-medium">{home?.name ?? "?"}</span>
                    <span className="text-muted-foreground text-sm mx-2">x</span>
                    <span className="font-medium">{away?.name ?? "?"}</span>
                    {away?.flag_url && <img src={away.flag_url} alt="" className="h-5 w-7 object-cover rounded" />}
                  </div>
                  {m.status === "finished" ? (
                    <span className="text-sm font-black tabular-nums text-gold">{m.home_score} x {m.away_score}</span>
                  ) : palpiteAberto ? (
                    <button onClick={() => { setSelected(m); setForm({ nome: "", whatsapp: "", palpite_a: 0, palpite_b: 0 }); setDone(null); }} className="text-sm font-bold uppercase tracking-wide text-gold hover:underline">Fazer palpite →</button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Encerrado</span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-gradient-card border border-border rounded-2xl max-w-md w-full p-6 card-elevated ring-conic" onClick={(e) => e.stopPropagation()}>
            {done ? (
              <SuccessPanel waLink={done.link} protocolo={done.protocolo} pix={pix!} valor={Number(bolao.valor_palpite)} onClose={() => setSelected(null)} />
            ) : (
              <form onSubmit={submitPalpite} className="space-y-3">
                <h3 className="font-display text-2xl font-black uppercase">Seu palpite</h3>
                <p className="text-sm text-muted-foreground">
                  {teams.get(selected.home_team_id ?? "")?.name} x {teams.get(selected.away_team_id ?? "")?.name}
                </p>
                <input required placeholder="Seu nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold" />
                <input required placeholder="WhatsApp (com DDD)" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: onlyDigits(e.target.value) })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold" />
                <div className="flex items-center gap-3 justify-center">
                  <input type="number" min={0} required value={form.palpite_a} onChange={(e) => setForm({ ...form, palpite_a: Number(e.target.value) })} className="w-20 text-center text-2xl font-black tabular-nums rounded-lg border border-border bg-background py-2 text-gold focus:outline-none focus:ring-2 focus:ring-gold" />
                  <span className="font-bold text-muted-foreground">x</span>
                  <input type="number" min={0} required value={form.palpite_b} onChange={(e) => setForm({ ...form, palpite_b: Number(e.target.value) })} className="w-20 text-center text-2xl font-black tabular-nums rounded-lg border border-border bg-background py-2 text-gold focus:outline-none focus:ring-2 focus:ring-gold" />
                </div>
                <p className="text-center text-sm">Valor: <strong className="text-gold">{brl(bolao.valor_palpite)}</strong></p>
                <button disabled={submitting} className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-gold font-black uppercase tracking-wide text-gold-foreground shadow-gold transition-transform hover:scale-[1.02] disabled:opacity-60">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar palpite"}
                </button>
                <button type="button" onClick={() => setSelected(null)} className="block w-full text-sm text-muted-foreground hover:underline">Cancelar</button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SuccessPanel({
  waLink,
  protocolo,
  pix,
  valor,
  onClose,
}: {
  waLink: string;
  protocolo: string;
  pix: { nome_recebedor: string; chave_pix: string; banco: string | null };
  valor: number;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const payload = useMemo(
    () => buildPixPayload({ chave: pix.chave_pix, nomeRecebedor: pix.nome_recebedor, valor }),
    [pix.chave_pix, pix.nome_recebedor, valor],
  );

  async function copyPix() {
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop */
    }
  }

  return (
    <div className="text-center space-y-4">
      <div className="text-4xl">🎉</div>
      <h3 className="text-xl font-black">Palpite registrado!</h3>
      <div className="inline-block rounded-lg bg-pitch/10 px-3 py-1 text-sm font-bold text-pitch">Protocolo: {protocolo}</div>
      <p className="text-sm text-muted-foreground">Guarde esse número para consultas. Pague o Pix e envie o comprovante pelo WhatsApp.</p>


      <div className="bg-white p-3 rounded-xl border border-border inline-block">
        <QRCodeSVG value={payload} size={180} />
      </div>
      <div className="text-xs text-muted-foreground">{pix.nome_recebedor} • {brl(valor)}</div>

      <button
        type="button"
        onClick={copyPix}
        className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-xl border border-border bg-background font-semibold text-sm"
      >
        {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
        {copied ? "Copiado!" : "Copiar Pix copia e cola"}
      </button>

      <a href={waLink} target="_blank" rel="noopener noreferrer" className="w-full inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-green-600 px-5 font-bold text-white">
        <MessageCircle className="h-5 w-5" /> Abrir WhatsApp
      </a>
      <button onClick={onClose} className="block w-full text-sm text-muted-foreground hover:underline">Fechar</button>
    </div>
  );
}
