import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { slugify, publicBolaoUrl } from "@/lib/saas";
import {
  Loader2, Save, Copy, Check, ExternalLink, Share2, Wand2, Calendar, RefreshCw,
  Settings, Megaphone, Trophy, DollarSign, Clock, Eye,
} from "lucide-react";

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

type Match = { id: string; kickoff_at: string; status: string; home_team_id: string; away_team_id: string };
type Team = { id: string; name: string; code: string; flag_url: string | null };
type TabId = "config" | "divulgacao" | "jogos";

function BolaoConfigPage() {
  const [bolaoId, setBolaoId] = useState<string | null>(null);
  const [form, setForm] = useState({
    nome: "", slug: "", descricao: "", regras: "", valor_palpite: 10,
    permitir_ranking_publico: true, permitir_ganhadores_publico: true,
    data_limite_palpite: "",
  });
  const [initialForm, setInitialForm] = useState(form);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Map<string, Team>>(new Map());
  const [loadingGames, setLoadingGames] = useState(false);
  const [selectedMatchIds, setSelectedMatchIds] = useState<Set<string>>(new Set());
  const [divulgCopied, setDivulgCopied] = useState(false);
  const [tab, setTab] = useState<TabId>("config");

  const shareUrl = useMemo(() => (form.slug ? publicBolaoUrl(form.slug) : ""), [form.slug]);
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(initialForm), [form, initialForm]);

  async function loadMatches() {
    setLoadingGames(true);
    const nowIso = new Date().toISOString();
    const [m, t] = await Promise.all([
      supabase.from("matches").select("id, kickoff_at, status, home_team_id, away_team_id")
        .eq("status", "scheduled").gte("kickoff_at", nowIso)
        .order("kickoff_at", { ascending: true }).limit(50),
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
        const next = {
          nome: b.nome, slug: b.slug, descricao: b.descricao ?? "", regras: b.regras ?? "",
          valor_palpite: Number(b.valor_palpite),
          permitir_ranking_publico: b.permitir_ranking_publico,
          permitir_ganhadores_publico: b.permitir_ganhadores_publico,
          data_limite_palpite: b.data_limite_palpite ? b.data_limite_palpite.slice(0, 16) : "",
        };
        setForm(next); setInitialForm(next);
      }
      await loadMatches();
    })();
  }, []);

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    if (!bolaoId) return;
    setSaving(true); setMsg(null);
    const payload = {
      ...form,
      slug: slugify(form.slug || form.nome),
      data_limite_palpite: form.data_limite_palpite ? new Date(form.data_limite_palpite).toISOString() : null,
    };
    const { error } = await supabase.from("boloes").update(payload).eq("id", bolaoId);
    setSaving(false);
    if (error) setMsg({ kind: "err", text: error.message });
    else { setMsg({ kind: "ok", text: "Alterações salvas." }); setInitialForm(form); }
  }

  async function copyShare() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }
  function shareWhatsApp() {
    const text = `Participe do ${form.nome}! Faça seu palpite: ${shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  const matchesByDate = useMemo(() => {
    const groups = new Map<string, Match[]>();
    for (const m of matches) {
      const d = new Date(m.kickoff_at).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
      const arr = groups.get(d) ?? [];
      arr.push(m); groups.set(d, arr);
    }
    return Array.from(groups.entries());
  }, [matches]);

  const proximoJogo = matches.find((m) => m.status !== "finished" && new Date(m.kickoff_at) > new Date());

  function toggleMatch(id: string) {
    setSelectedMatchIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAllVisible() {
    const all = matches.map((m) => m.id);
    const allSelected = all.every((id) => selectedMatchIds.has(id));
    setSelectedMatchIds(allSelected ? new Set() : new Set(all));
  }

  const divulgacaoTexto = useMemo(() => {
    const sel = matches.filter((m) => selectedMatchIds.has(m.id));
    if (sel.length === 0) return "";
    const linhas = sel.map((m) => {
      const home = teams.get(m.home_team_id)?.name ?? "?";
      const away = teams.get(m.away_team_id)?.name ?? "?";
      const dt = new Date(m.kickoff_at).toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
      return `⚽ ${dt} — ${home} x ${away}`;
    });
    return [
      `🏆 ${form.nome || "Bolão"}`, ``, `Palpite nos próximos jogos:`, ...linhas, ``,
      form.valor_palpite ? `💰 R$ ${Number(form.valor_palpite).toFixed(2)} por palpite` : "",
      shareUrl ? `👉 ${shareUrl}` : "",
    ].filter(Boolean).join("\n");
  }, [matches, selectedMatchIds, teams, form.nome, form.valor_palpite, shareUrl]);

  async function copyDivulgacao() {
    if (!divulgacaoTexto) return;
    await navigator.clipboard.writeText(divulgacaoTexto);
    setDivulgCopied(true); setTimeout(() => setDivulgCopied(false), 2000);
  }
  function shareDivulgacaoWhatsApp() {
    if (!divulgacaoTexto) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(divulgacaoTexto)}`, "_blank");
  }

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "config", label: "Configuração", icon: <Settings className="h-4 w-4" /> },
    { id: "divulgacao", label: "Divulgação", icon: <Megaphone className="h-4 w-4" /> },
    { id: "jogos", label: "Jogos & Divulgação em massa", icon: <Calendar className="h-4 w-4" /> },
  ];

  return (
    <div className="max-w-4xl space-y-6 pb-24">
      {/* HEADER */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><Trophy className="h-3.5 w-3.5 text-pitch" /> Meu bolão</div>
          <h1 className="mt-1 text-3xl font-black leading-tight">{form.nome || "Sem nome ainda"}</h1>
          {shareUrl && (
            <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-pitch">
              <Eye className="h-3 w-3" /> {shareUrl.replace(/^https?:\/\//, "")}
            </a>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 text-center sm:text-right">
          <Stat icon={<DollarSign className="h-3.5 w-3.5" />} label="Valor" value={`R$ ${Number(form.valor_palpite || 0).toFixed(0)}`} />
          <Stat icon={<Calendar className="h-3.5 w-3.5" />} label="Jogos" value={String(matches.length)} />
          <Stat icon={<Clock className="h-3.5 w-3.5" />} label="Limite" value={form.data_limite_palpite ? new Date(form.data_limite_palpite).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—"} />
        </div>
      </header>

      {/* TABS */}
      <nav className="flex gap-1 border-b border-border overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap ${tab === t.id ? "border-pitch text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </nav>

      {/* TAB: CONFIGURAÇÃO */}
      {tab === "config" && (
        <form onSubmit={save} className="space-y-5">
          <Card title="Identidade" desc="Como o bolão aparece para os torcedores.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome do bolão"><input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className={inputCss} placeholder="Ex.: Bolão da firma" /></Field>
              <Field label="Slug (link público)" hint={shareUrl ? `/${form.slug}` : "Aparece em /bolao/..."}>
                <input required value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} className={inputCss} />
              </Field>
            </div>
            <Field label="Descrição curta"><textarea rows={2} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className={inputCss} placeholder="Aparece no topo da página pública." /></Field>
          </Card>

          <Card title="Regras" desc="Defina pontuação, premiação e condições. Texto livre.">
            <div className="flex items-center justify-end -mt-2 mb-1">
              <button type="button" onClick={() => setForm({ ...form, regras: SUGESTAO_REGRAS })} className="inline-flex items-center gap-1 text-xs font-semibold text-pitch hover:underline">
                <Wand2 className="h-3 w-3" /> Usar sugestão (editável)
              </button>
            </div>
            <textarea rows={10} value={form.regras} onChange={(e) => setForm({ ...form, regras: e.target.value })} className={inputCss} placeholder={SUGESTAO_REGRAS} />
          </Card>

          <Card title="Apostas & prazos">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Valor do palpite (R$)"><input type="number" min={0} step="0.01" value={form.valor_palpite} onChange={(e) => setForm({ ...form, valor_palpite: Number(e.target.value) })} className={inputCss} /></Field>
              <Field label="Data limite para palpite">
                <input type="datetime-local" value={form.data_limite_palpite} onChange={(e) => setForm({ ...form, data_limite_palpite: e.target.value })} className={inputCss} />
                {proximoJogo && (
                  <button type="button" onClick={() => setForm({ ...form, data_limite_palpite: new Date(proximoJogo.kickoff_at).toISOString().slice(0, 16) })} className="mt-1 text-xs font-semibold text-pitch hover:underline">
                    Usar início do próximo jogo ({new Date(proximoJogo.kickoff_at).toLocaleString("pt-BR")})
                  </button>
                )}
              </Field>
            </div>
          </Card>

          <Card title="Visibilidade pública">
            <div className="space-y-2">
              <Toggle checked={form.permitir_ranking_publico} onChange={(v) => setForm({ ...form, permitir_ranking_publico: v })} label="Ranking público" desc="Qualquer pessoa com o link vê o ranking." />
              <Toggle checked={form.permitir_ganhadores_publico} onChange={(v) => setForm({ ...form, permitir_ganhadores_publico: v })} label="Lista de ganhadores pública" desc="Mostrar histórico de premiados na página pública." />
            </div>
          </Card>
        </form>
      )}

      {/* TAB: DIVULGAÇÃO */}
      {tab === "divulgacao" && (
        <Card title="Link público" desc="Compartilhe este link para receber palpites.">
          {shareUrl ? (
            <>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm font-mono break-all">{shareUrl}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={copyShare} className={btnSecondary}>
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />} {copied ? "Copiado!" : "Copiar link"}
                </button>
                <button type="button" onClick={shareWhatsApp} className={btnWhats}>
                  <Share2 className="h-4 w-4" /> WhatsApp
                </button>
                <a href={shareUrl} target="_blank" rel="noopener noreferrer" className={btnSecondary}>
                  <ExternalLink className="h-4 w-4" /> Abrir página pública
                </a>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Defina um <b>slug</b> na aba Configuração para gerar o link público.</p>
          )}
        </Card>
      )}

      {/* TAB: JOGOS */}
      {tab === "jogos" && (
        <Card
          title="Jogos agendados"
          desc="Selecione jogos para montar uma divulgação rica em WhatsApp. Apenas jogos não iniciados são listados."
          action={
            <div className="flex items-center gap-3">
              {matches.length > 0 && (
                <button type="button" onClick={toggleAllVisible} className="text-xs font-semibold text-muted-foreground hover:text-foreground">
                  {matches.every((m) => selectedMatchIds.has(m.id)) ? "Limpar" : "Selecionar todos"}
                </button>
              )}
              <button type="button" onClick={loadMatches} disabled={loadingGames} className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
                <RefreshCw className={`h-3 w-3 ${loadingGames ? "animate-spin" : ""}`} /> Atualizar
              </button>
            </div>
          }
        >
          {loadingGames ? (
            <div className="py-8 text-center text-sm text-muted-foreground"><Loader2 className="inline h-4 w-4 animate-spin" /></div>
          ) : matchesByDate.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum jogo agendado.</p>
          ) : (
            <div className="space-y-4 max-h-[28rem] overflow-y-auto pr-1">
              {matchesByDate.map(([date, ms]) => (
                <div key={date}>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">{date}</div>
                  <div className="space-y-1.5">
                    {ms.map((m) => {
                      const home = teams.get(m.home_team_id);
                      const away = teams.get(m.away_team_id);
                      const checked = selectedMatchIds.has(m.id);
                      return (
                        <label key={m.id} className={`flex items-center gap-3 text-sm rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${checked ? "border-pitch bg-pitch/5" : "border-border bg-background hover:border-pitch/40"}`}>
                          <input type="checkbox" checked={checked} onChange={() => toggleMatch(m.id)} className="accent-pitch" />
                          <span className="text-xs font-semibold text-muted-foreground w-12 tabular-nums">{new Date(m.kickoff_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                          <span className="flex flex-1 items-center gap-2 min-w-0">
                            <TeamChip team={home} /> <span className="text-muted-foreground">×</span> <TeamChip team={away} />
                          </span>
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-pitch/10 text-pitch">Agendado</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedMatchIds.size > 0 && (
            <div className="mt-5 rounded-xl border border-pitch/30 bg-pitch/5 p-4 space-y-2">
              <div className="flex items-center gap-2"><Megaphone className="h-4 w-4 text-pitch" /><span className="text-sm font-bold">Divulgação ({selectedMatchIds.size} jogo{selectedMatchIds.size > 1 ? "s" : ""})</span></div>
              <textarea readOnly value={divulgacaoTexto} rows={Math.min(14, divulgacaoTexto.split("\n").length + 1)} className={`${inputCss} font-mono text-xs`} />
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={copyDivulgacao} className={btnSecondary}>
                  {divulgCopied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />} {divulgCopied ? "Copiado!" : "Copiar texto"}
                </button>
                <button type="button" onClick={shareDivulgacaoWhatsApp} className={btnWhats}>
                  <Share2 className="h-4 w-4" /> Enviar no WhatsApp
                </button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* SAVE BAR — fixa quando há alterações */}
      {tab === "config" && (
        <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-30 transition-all ${dirty || msg ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"}`}>
          <div className="flex items-center gap-3 rounded-full border border-border bg-card/95 backdrop-blur px-4 py-2 shadow-lg">
            {msg ? (
              <span className={`text-sm font-semibold ${msg.kind === "ok" ? "text-green-600" : "text-destructive"}`}>{msg.text}</span>
            ) : (
              <span className="text-sm text-muted-foreground">Alterações não salvas</span>
            )}
            <button onClick={() => save()} disabled={saving || !dirty} className="inline-flex h-9 items-center gap-2 rounded-full bg-pitch px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">Torcedores palpitam na <Link to="/bolao/$slug" params={{ slug: form.slug || "_" }} className="text-pitch font-semibold hover:underline">página pública</Link>.</p>
    </div>
  );
}

/* ---------- Subcomponents ---------- */

function Card({ title, desc, action, children }: { title: string; desc?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-bold">{title}</h2>
          {desc && <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <div className="flex items-center justify-center sm:justify-end gap-1 text-[10px] uppercase font-bold tracking-wider text-muted-foreground">{icon}{label}</div>
      <div className="mt-0.5 text-sm font-black tabular-nums">{value}</div>
    </div>
  );
}

function Toggle({ checked, onChange, label, desc }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-border bg-background p-3 cursor-pointer hover:border-pitch/40">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 accent-pitch" />
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        {desc && <span className="block text-xs text-muted-foreground">{desc}</span>}
      </span>
    </label>
  );
}

function TeamChip({ team }: { team?: Team }) {
  return (
    <span className="flex items-center gap-1.5 min-w-0">
      {team?.flag_url
        ? <img src={team.flag_url} alt={team.code} className="h-4 w-6 object-cover rounded-sm ring-1 ring-border shrink-0" loading="lazy" />
        : <span className="h-4 w-6 rounded-sm bg-muted text-[9px] font-bold grid place-items-center shrink-0">{team?.code ?? "?"}</span>}
      <span className="truncate font-medium">{team?.name ?? "?"}</span>
    </span>
  );
}

const inputCss = "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-pitch/40";
const btnSecondary = "inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-semibold hover:border-pitch/40";
const btnWhats = "inline-flex h-9 items-center gap-2 rounded-lg bg-green-600 px-3 text-sm font-semibold text-white hover:bg-green-700";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-sm font-medium">{label}{hint && <span className="text-xs text-muted-foreground font-normal">{hint}</span>}</span>
      {children}
    </label>
  );
}
