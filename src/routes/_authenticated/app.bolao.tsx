import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { slugify, publicBolaoUrl } from "@/lib/saas";
import { Loader2, Save, Copy, Check, ExternalLink, Share2, Wand2, Calendar, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/bolao")({
  component: BolaoConfigPage,
});

const SUGESTAO_REGRAS = `• Valor do palpite: R$ 10 por jogo.
• Acertou o placar exato: 3 pontos. Acertou só o vencedor/empate: 1 ponto.
• Distribuição do prêmio (do total arrecadado):
   - 70% para o 1º colocado
   - 20% para o 2º colocado
   - 10% taxa de administração (organizador)
• Em caso de empate na pontuação, o prêmio é dividido igualmente.
• Palpites só são válidos após confirmação do Pix.
• Não são aceitos palpites após o início da partida.`;

type Match = {
  id: string;
  kickoff_at: string;
  status: string;
  home_team_id: string;
  away_team_id: string;
};
type Team = { id: string; name: string; code: string; flag_url: string | null };

function BolaoConfigPage() {
  const [bolaoId, setBolaoId] = useState<string | null>(null);
  const [form, setForm] = useState({
    nome: "", slug: "", descricao: "", regras: "", valor_palpite: 10,
    permitir_ranking_publico: true, permitir_ganhadores_publico: true,
    data_limite_palpite: "",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Map<string, Team>>(new Map());
  const [loadingGames, setLoadingGames] = useState(false);

  const shareUrl = useMemo(() => (form.slug ? publicBolaoUrl(form.slug) : ""), [form.slug]);

  async function loadMatches() {
    setLoadingGames(true);
    const [m, t] = await Promise.all([
      supabase.from("matches").select("id, kickoff_at, status, home_team_id, away_team_id").order("kickoff_at", { ascending: true }).limit(50),
      supabase.from("teams").select("id, name, code, flag_url"),
    ]);
    setMatches((m.data ?? []) as Match[]);
    setTeams(new Map((t.data ?? []).map((x) => [x.id, x as Team])));
    setLoadingGames(false);
  }

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data: t } = await supabase.from("tenants").select("id").eq("owner_user_id", u.user!.id).single();
      if (!t) return;
      const { data: b } = await supabase.from("boloes").select("*").eq("tenant_id", t.id).order("created_at", { ascending: true }).limit(1).maybeSingle();
      if (b) {
        setBolaoId(b.id);
        setForm({
          nome: b.nome, slug: b.slug, descricao: b.descricao ?? "", regras: b.regras ?? "",
          valor_palpite: Number(b.valor_palpite),
          permitir_ranking_publico: b.permitir_ranking_publico,
          permitir_ganhadores_publico: b.permitir_ganhadores_publico,
          data_limite_palpite: b.data_limite_palpite ? b.data_limite_palpite.slice(0, 16) : "",
        });
      }
      await loadMatches();
    })();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!bolaoId) return;
    setSaving(true); setMsg(null);
    const payload = {
      ...form,
      slug: slugify(form.slug || form.nome),
      data_limite_palpite: form.data_limite_palpite ? new Date(form.data_limite_palpite).toISOString() : null,
    };
    const { error } = await supabase.from("boloes").update(payload).eq("id", bolaoId);
    setSaving(false);
    setMsg(error ? `Erro: ${error.message}` : "Salvo!");
  }

  async function copyShare() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function shareWhatsApp() {
    const text = `Participe do ${form.nome}! Faça seu palpite: ${shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  // Agrupa jogos por data
  const matchesByDate = useMemo(() => {
    const groups = new Map<string, Match[]>();
    for (const m of matches) {
      const d = new Date(m.kickoff_at).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
      const arr = groups.get(d) ?? [];
      arr.push(m);
      groups.set(d, arr);
    }
    return Array.from(groups.entries());
  }, [matches]);

  const proximoJogo = matches.find((m) => m.status !== "finished" && new Date(m.kickoff_at) > new Date());

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-black">Meu bolão</h1>

      {/* CARD: Compartilhar */}
      {shareUrl && (
        <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2"><Share2 className="h-4 w-4 text-pitch" /><h2 className="font-bold">Link para compartilhar</h2></div>
          <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm font-mono break-all">{shareUrl}</div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={copyShare} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-semibold">
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />} {copied ? "Copiado!" : "Copiar link"}
            </button>
            <button type="button" onClick={shareWhatsApp} className="inline-flex h-9 items-center gap-2 rounded-lg bg-green-600 px-3 text-sm font-semibold text-white">
              <Share2 className="h-4 w-4" /> Compartilhar no WhatsApp
            </button>
            <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-semibold">
              <ExternalLink className="h-4 w-4" /> Abrir página pública
            </a>
          </div>
        </section>
      )}

      {/* FORM: Configuração */}
      <form onSubmit={save} className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <h2 className="font-bold">Configuração</h2>
        <Field label="Nome"><input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className={inputCss} /></Field>
        <Field label="Slug (link público /bolao/...)"><input required value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} className={inputCss} /></Field>
        <Field label="Descrição"><textarea rows={2} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className={inputCss} /></Field>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium">Regras</span>
            <button type="button" onClick={() => setForm({ ...form, regras: SUGESTAO_REGRAS })} className="inline-flex items-center gap-1 text-xs font-semibold text-pitch hover:underline">
              <Wand2 className="h-3 w-3" /> Usar sugestão (editável)
            </button>
          </div>
          <textarea rows={10} value={form.regras} onChange={(e) => setForm({ ...form, regras: e.target.value })} className={inputCss} placeholder={SUGESTAO_REGRAS} />
          <p className="mt-1 text-xs text-muted-foreground">Clique em "Usar sugestão" para preencher com um modelo padrão (pontuação + divisão do prêmio) e edite à vontade.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor do palpite (R$)"><input type="number" value={form.valor_palpite} onChange={(e) => setForm({ ...form, valor_palpite: Number(e.target.value) })} className={inputCss} /></Field>
          <div>
            <Field label="Data limite para palpite"><input type="datetime-local" value={form.data_limite_palpite} onChange={(e) => setForm({ ...form, data_limite_palpite: e.target.value })} className={inputCss} /></Field>
            {proximoJogo && (
              <button type="button" onClick={() => setForm({ ...form, data_limite_palpite: new Date(proximoJogo.kickoff_at).toISOString().slice(0, 16) })} className="mt-1 text-xs font-semibold text-pitch hover:underline">
                Usar início do próximo jogo ({new Date(proximoJogo.kickoff_at).toLocaleString("pt-BR")})
              </button>
            )}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.permitir_ranking_publico} onChange={(e) => setForm({ ...form, permitir_ranking_publico: e.target.checked })} /> Permitir ranking público</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.permitir_ganhadores_publico} onChange={(e) => setForm({ ...form, permitir_ganhadores_publico: e.target.checked })} /> Permitir lista pública de ganhadores</label>

        <button disabled={saving} className="inline-flex h-11 items-center gap-2 rounded-xl bg-pitch px-5 font-semibold text-primary-foreground disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
        </button>
        {msg && <p className="text-sm">{msg}</p>}
      </form>

      {/* CARD: Jogos vinculados (tabela atualizada pela API) */}
      <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-pitch" /><h2 className="font-bold">Jogos vinculados</h2></div>
          <button type="button" onClick={loadMatches} disabled={loadingGames} className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
            <RefreshCw className={`h-3 w-3 ${loadingGames ? "animate-spin" : ""}`} /> Atualizar
          </button>
        </div>
        <p className="text-xs text-muted-foreground">Tabela oficial sincronizada pela API. Os torcedores podem palpitar em qualquer jogo aberto na <Link to="/bolao/$slug" params={{ slug: form.slug || "_" }} className="text-pitch font-semibold hover:underline">página pública</Link>.</p>
        {loadingGames ? (
          <div className="py-6 text-center text-sm text-muted-foreground"><Loader2 className="inline h-4 w-4 animate-spin" /></div>
        ) : matchesByDate.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum jogo cadastrado ainda.</p>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {matchesByDate.map(([date, ms]) => (
              <div key={date}>
                <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">{date}</div>
                <div className="space-y-1">
                  {ms.map((m) => {
                    const home = teams.get(m.home_team_id);
                    const away = teams.get(m.away_team_id);
                    return (
                      <div key={m.id} className="flex items-center gap-2 text-sm rounded-lg border border-border bg-background px-3 py-2">
                        <span className="text-xs text-muted-foreground w-12">{new Date(m.kickoff_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                        <span className="flex-1">{home?.name ?? "?"} <span className="text-muted-foreground">x</span> {away?.name ?? "?"}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${m.status === "finished" ? "bg-muted text-muted-foreground" : "bg-pitch/10 text-pitch"}`}>{m.status === "finished" ? "Encerrado" : m.status === "live" ? "Ao vivo" : "Agendado"}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

const inputCss = "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-pitch/40";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-sm font-medium">{label}</span>{children}</label>;
}
