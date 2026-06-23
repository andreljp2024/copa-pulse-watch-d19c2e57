import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import confetti from "canvas-confetti";
import { supabase } from "@/integrations/supabase/client";
import { brl, buildWhatsAppLink, interpolate, onlyDigits } from "@/lib/saas";
import { buildPixPayload } from "@/lib/pix";
import { Trophy, MessageCircle, Loader2, Copy, Check, ListOrdered } from "lucide-react";

export const Route = createFileRoute("/bolao/$slug")({
  loader: async ({ params }) => {
    const { data: bolao } = await supabase.from("boloes").select("*").eq("slug", params.slug).eq("status", "active").maybeSingle();
    if (!bolao) throw notFound();
    return { bolao };
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [
      { title: `${loaderData.bolao.nome} — Bolão Copa 2026` },
      { name: "description", content: loaderData.bolao.descricao ?? `Participe do ${loaderData.bolao.nome}.` },
      { property: "og:title", content: loaderData.bolao.nome },
      { property: "og:description", content: loaderData.bolao.descricao ?? "Faça seu palpite e concorra." },
      ...(loaderData.bolao.logo_url ? [{ property: "og:image", content: loaderData.bolao.logo_url }] : []),
    ] : [],
  }),
  component: PublicBolao,
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center p-8 text-center">
      <div>
        <h1 className="text-3xl font-black">Bolão não encontrado</h1>
        <Link to="/" className="mt-4 inline-block text-pitch font-semibold">Voltar</Link>
      </div>
    </div>
  ),
});

type Match = {
  id: string;
  home_team_id: string | null;
  away_team_id: string | null;
  kickoff_at: string | null;
  status: string;
  home_score: number | null;
  away_score: number | null;
};

function PublicBolao() {
  const { bolao } = Route.useLoaderData();
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Map<string, { name: string; code: string; flag_url: string | null }>>(new Map());
  const [pix, setPix] = useState<{ nome_recebedor: string; chave_pix: string; banco: string | null; valor_padrao_palpite: number } | null>(null);
  const [wa, setWa] = useState<{ numero_whatsapp: string; mensagem_novo_palpite: string | null } | null>(null);
  const [selected, setSelected] = useState<Match | null>(null);
  const [form, setForm] = useState({ nome: "", whatsapp: "", palpite_a: 0, palpite_b: 0 });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [m, t, p, w] = await Promise.all([
        supabase.from("matches").select("id, home_team_id, away_team_id, kickoff_at, status, home_score, away_score").order("kickoff_at", { ascending: true }),
        supabase.from("teams").select("id, name, code, flag_url"),
        supabase.from("tenant_pix_config").select("nome_recebedor, chave_pix, banco, valor_padrao_palpite").eq("tenant_id", bolao.tenant_id).maybeSingle(),
        supabase.from("tenant_whatsapp_config").select("numero_whatsapp, mensagem_novo_palpite").eq("tenant_id", bolao.tenant_id).maybeSingle(),
      ]);
      setMatches((m.data ?? []) as Match[]);
      setTeams(new Map((t.data ?? []).map((x) => [x.id, { name: x.name, code: x.code, flag_url: x.flag_url }])));
      if (p.data) setPix({ ...p.data, valor_padrao_palpite: Number(p.data.valor_padrao_palpite) });
      setWa(w.data);
    })();
  }, [bolao.tenant_id]);

  const palpiteAberto = useMemo(() => {
    if (!bolao.data_limite_palpite) return true;
    return new Date(bolao.data_limite_palpite) > new Date();
  }, [bolao.data_limite_palpite]);

  async function submitPalpite(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !wa || !pix) return;
    setSubmitting(true);
    try {
      const { data: tor, error: e1 } = await supabase.from("torcedores").insert({
        tenant_id: bolao.tenant_id, bolao_id: bolao.id, nome: form.nome, whatsapp: form.whatsapp,
      }).select("id").single();
      if (e1) throw e1;
      const { data: pal, error: e2 } = await supabase.from("palpites").insert({
        tenant_id: bolao.tenant_id, bolao_id: bolao.id, torcedor_id: tor.id, match_id: selected.id,
        palpite_a: form.palpite_a, palpite_b: form.palpite_b, valor: Number(bolao.valor_palpite),
      }).select("id").single();
      if (e2) throw e2;
      const home = teams.get(selected.home_team_id ?? "");
      const away = teams.get(selected.away_team_id ?? "");
      const msg = interpolate(wa.mensagem_novo_palpite ?? "", {
        nome_bolao: bolao.nome,
        nome_torcedor: form.nome,
        whatsapp_torcedor: form.whatsapp,
        selecao_a: home?.name ?? "",
        selecao_b: away?.name ?? "",
        palpite_a: form.palpite_a,
        palpite_b: form.palpite_b,
        valor_palpite: brl(bolao.valor_palpite),
        nome_recebedor: pix.nome_recebedor,
        banco: pix.banco ?? "",
        chave_pix: pix.chave_pix,
      });
      setDone(buildWhatsAppLink(wa.numero_whatsapp, msg));
      void pal;
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao enviar palpite");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b border-border" style={{ background: bolao.cor_primaria ?? "#0f766e", color: "white" }}>
        <div className="mx-auto max-w-5xl px-4 py-8 flex items-center gap-4">
          {bolao.logo_url ? (
            <img src={bolao.logo_url} alt="" className="h-16 w-16 rounded-xl object-cover bg-white" />
          ) : (
            <div className="h-16 w-16 rounded-xl bg-white/15 grid place-items-center"><Trophy className="h-8 w-8" /></div>
          )}
          <div>
            <h1 className="text-2xl sm:text-3xl font-black">{bolao.nome}</h1>
            <p className="text-sm opacity-90">Valor do palpite: {brl(bolao.valor_palpite)}</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 pt-4">
        <Link to="/bolao/$slug/ranking" params={{ slug: bolao.slug }} className="inline-flex items-center gap-2 text-sm font-semibold text-pitch hover:underline">
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
          <h2 className="text-xl font-black mb-3">Jogos</h2>
          {!palpiteAberto && <p className="mb-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">⏰ Período de palpites encerrado.</p>}
          <div className="grid gap-2">
            {matches.slice(0, 30).map((m) => {
              const home = teams.get(m.home_team_id ?? "");
              const away = teams.get(m.away_team_id ?? "");
              return (
                <div key={m.id} className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
                  <div className="flex-1 flex items-center gap-2">
                    {home?.flag_url && <img src={home.flag_url} alt="" className="h-5 w-7 object-cover rounded" />}
                    <span className="font-medium">{home?.name ?? "?"}</span>
                    <span className="text-muted-foreground text-sm mx-2">x</span>
                    <span className="font-medium">{away?.name ?? "?"}</span>
                    {away?.flag_url && <img src={away.flag_url} alt="" className="h-5 w-7 object-cover rounded" />}
                  </div>
                  {m.status === "finished" ? (
                    <span className="text-sm font-bold">{m.home_score} x {m.away_score}</span>
                  ) : palpiteAberto ? (
                    <button onClick={() => { setSelected(m); setForm({ nome: "", whatsapp: "", palpite_a: 0, palpite_b: 0 }); setDone(null); }} className="text-sm font-semibold text-pitch hover:underline">Fazer palpite →</button>
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
        <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-card rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            {done ? (
              <div className="text-center space-y-4">
                <div className="text-5xl">🎉</div>
                <h3 className="text-xl font-black">Palpite registrado!</h3>
                <p className="text-sm text-muted-foreground">Para confirmar, envie a mensagem pelo WhatsApp e faça o Pix.</p>
                <a href={done} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center gap-2 rounded-xl bg-green-600 px-5 font-bold text-white">
                  <MessageCircle className="h-5 w-5" /> Abrir WhatsApp
                </a>
                <button onClick={() => setSelected(null)} className="block w-full text-sm text-muted-foreground hover:underline">Fechar</button>
              </div>
            ) : (
              <form onSubmit={submitPalpite} className="space-y-3">
                <h3 className="text-xl font-black">Seu palpite</h3>
                <p className="text-sm text-muted-foreground">
                  {teams.get(selected.home_team_id ?? "")?.name} x {teams.get(selected.away_team_id ?? "")?.name}
                </p>
                <input required placeholder="Seu nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                <input required placeholder="WhatsApp (com DDD)" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: onlyDigits(e.target.value) })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                <div className="flex items-center gap-3 justify-center">
                  <input type="number" min={0} required value={form.palpite_a} onChange={(e) => setForm({ ...form, palpite_a: Number(e.target.value) })} className="w-20 text-center text-2xl font-black rounded-lg border border-border bg-background py-2" />
                  <span className="font-bold">x</span>
                  <input type="number" min={0} required value={form.palpite_b} onChange={(e) => setForm({ ...form, palpite_b: Number(e.target.value) })} className="w-20 text-center text-2xl font-black rounded-lg border border-border bg-background py-2" />
                </div>
                <p className="text-center text-sm">Valor: <strong>{brl(bolao.valor_palpite)}</strong></p>
                <button disabled={submitting} className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-pitch font-semibold text-primary-foreground disabled:opacity-60">
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
