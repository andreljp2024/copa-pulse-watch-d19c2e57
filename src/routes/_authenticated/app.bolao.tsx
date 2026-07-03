import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { slugify, publicBolaoUrl } from "@/lib/saas";
import { ptTeamName } from "@/components/MatchCard";
import { flagEmojiFromCode } from "@/lib/flags";
import { saveBolao, type SaveBolaoResult } from "@/lib/bolao.functions";
import { syncMatchesForTenant } from "@/lib/sync.functions";
import { toast } from "sonner";
import { toDatetimeLocalBR, fromDatetimeLocalBR } from "@/lib/timezone";
import {
  Loader2,
  Save,
  Copy,
  Check,
  ExternalLink,
  Share2,
  Wand2,
  Calendar,
  RefreshCw,
  Settings,
  Megaphone,
  Trophy,
  DollarSign,
  Clock,
  Eye,
  ChevronRight,
  AlertCircle,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/bolao")({
  component: BolaoConfigPage,
});

const SUGESTAO_REGRAS = `📜 *REGRAS DO BOLÃO* 🏆⚽

⏱️ *1. Placar considerado*
✅ Vale o placar do *tempo normal* (com acréscimos) + *prorrogação* (se houver).
⚽ Gols marcados *dentro dos 120 minutos* (tempo normal + prorrogação) *CONTAM* normalmente.
❌ *Disputa de pênaltis NÃO conta* — serve apenas para definir quem avança na competição.
📌 Ou seja: se o jogo terminar empatado após os 120 min, o *placar oficial do bolão é o empate*, independente de quem vencer nos pênaltis.

💰 *2. Valor e prazo do palpite*
💵 R$ 10,00 por jogo.
📲 O palpite só vale após a *confirmação do Pix*.
⏰ Não são aceitos palpites *após o início da partida*.

🎯 *3. Como pontuar / ganhar*
🥇 Ganha quem acertar o *placar exato* do jogo.
🤝 Havendo mais de um ganhador, o prêmio é *dividido igualmente*.

🏅 *4. Distribuição do prêmio* (do total arrecadado)
💚 80% para o(s) torcedor(es) com palpite exato.
💛 20% taxa da organização (custeio da confraternização 🍻🍿).

🔞 *5. Participação*
👤 Apenas maiores de *+18 anos*.
🚫 Bolão AI *não é bets* — é cortesia entre amigos rumo ao *Hexa* 🇧🇷.`;

type Match = {
  id: string;
  kickoff_at: string;
  status: string;
  home_team_id: string;
  away_team_id: string;
};
type Team = { id: string; name: string; code: string; flag_url: string | null };
type TabId = "config" | "divulgar";

function BolaoConfigPage() {
  const [bolaoId, setBolaoId] = useState<string | null>(null);
  const [form, setForm] = useState({
    nome: "",
    slug: "",
    descricao: "",
    regras: "",
    valor_palpite: 10,
    percentual_admin: 20,
    permitir_ranking_publico: true,
    permitir_ganhadores_publico: true,
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
  const [initialSelectedIds, setInitialSelectedIds] = useState<Set<string>>(new Set());
  const [divulgCopied, setDivulgCopied] = useState(false);
  const [tab, setTab] = useState<TabId>("config");
  const saveBolaoFn = useServerFn(saveBolao);
  const syncApiFn = useServerFn(syncMatchesForTenant);
  const [syncing, setSyncing] = useState(false);
  const [pixInfo, setPixInfo] = useState<{ nome_recebedor: string; chave_pix: string; banco: string | null; tipo_chave_pix: string | null } | null>(null);

  const shareUrl = useMemo(() => (form.slug ? publicBolaoUrl(form.slug) : ""), [form.slug]);
  const selectionDirty = useMemo(() => {
    if (selectedMatchIds.size !== initialSelectedIds.size) return true;
    for (const id of selectedMatchIds) if (!initialSelectedIds.has(id)) return true;
    return false;
  }, [selectedMatchIds, initialSelectedIds]);
  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initialForm) || selectionDirty,
    [form, initialForm, selectionDirty],
  );

  async function loadMatches() {
    setLoadingGames(true);
    const nowUtc = new Date(Date.now() - 3 * 3600_000).toISOString();
    const [m, t] = await Promise.all([
      supabase
        .from("matches")
        .select("id, kickoff_at, status, home_team_id, away_team_id")
        .eq("status", "scheduled")
        .not("kickoff_at", "is", null)
        .not("home_team_id", "is", null)
        .not("away_team_id", "is", null)
        .gte("kickoff_at", nowUtc)
        .order("kickoff_at", { ascending: true })
        .limit(50),
      supabase.from("teams").select("id, name, code, flag_url"),
    ]);
    setMatches((m.data ?? []) as Match[]);
    setTeams(new Map((t.data ?? []).map((x) => [x.id, x as Team])));
    setLoadingGames(false);
  }

  async function syncWithApi() {
    setSyncing(true);
    try {
      const res = (await syncApiFn()) as {
        teams_upserted?: number;
        matches_upserted?: number;
        source?: string;
      };
      toast.success(
        `Sincronizado (${res.source ?? "api"}): ${res.matches_upserted ?? 0} jogos, ${res.teams_upserted ?? 0} seleções`,
      );
      await loadMatches();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Falha ao sincronizar: ${msg}`);
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    (async () => {
      const { data: u, error: userErr } = await supabase.auth.getUser();
      if (userErr || !u?.user) {
        console.error("[load] Erro auth:", userErr);
        return;
      }

      const tRes = await supabase
        .from("tenants")
        .select("id")
        .eq("owner_user_id", u.user.id)
        .limit(1);
      const t = Array.isArray(tRes.data) ? tRes.data[0] : tRes.data;
      if (tRes.error || !t?.id) {
        console.error("[load] Erro tenant:", tRes.error, "t:", tRes.data);
        return;
      }

      const bRes = await supabase
        .from("boloes")
        .select("*")
        .eq("tenant_id", t.id)
        .order("created_at", { ascending: true })
        .limit(1);
      const b = Array.isArray(bRes.data) ? bRes.data[0] : bRes.data;
      if (bRes.error) console.error("[load] Erro bolão:", bRes.error);
      if (b) {
        setBolaoId(b.id);
        const next = {
          nome: b.nome,
          slug: b.slug,
          descricao: b.descricao ?? "",
          regras: b.regras ?? "",
          valor_palpite: Number(b.valor_palpite),
          percentual_admin: Number((b as any).percentual_admin ?? 20),
          permitir_ranking_publico: b.permitir_ranking_publico,
          permitir_ganhadores_publico: b.permitir_ganhadores_publico,
          data_limite_palpite: b.data_limite_palpite ? toDatetimeLocalBR(b.data_limite_palpite) : "",
        };
        setForm(next);
        setInitialForm(next);
        const { data: bm } = await supabase
          .from("bolao_matches")
          .select("match_id")
          .eq("bolao_id", b.id);
        const ids = new Set<string>((bm ?? []).map((r: any) => r.match_id));
        setSelectedMatchIds(ids);
        setInitialSelectedIds(ids);
      }
      // Carrega dados do Pix (destino do recebimento)
      const pixRes = await supabase
        .from("tenant_pix_config")
        .select("nome_recebedor, chave_pix, banco, tipo_chave_pix")
        .eq("tenant_id", t.id)
        .maybeSingle();
      if (pixRes.data) setPixInfo(pixRes.data as any);
      await loadMatches();
    })();
  }, []);

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    if (!bolaoId) {
      toast.error("Nenhum bolão encontrado. Complete o onboarding primeiro.");
      return;
    }
    setSaving(true);
    setMsg(null);
    const s = slugify(form.slug || form.nome);

    try {
      const result = await saveBolaoFn({
        data: {
          bolao_id: bolaoId,
          nome: form.nome,
          slug: s,
          descricao: form.descricao,
          regras: form.regras,
          valor_palpite: form.valor_palpite,
          percentual_admin: form.percentual_admin,
          permitir_ranking_publico: form.permitir_ranking_publico,
          permitir_ganhadores_publico: form.permitir_ganhadores_publico,
          data_limite_palpite: form.data_limite_palpite
            ? fromDatetimeLocalBR(form.data_limite_palpite).toISOString()
            : null,
          match_ids: [...selectedMatchIds],
        },
      });
      setSaving(false);
      if (!result?.ok) {
        const errMsg = result?.message ?? "Erro desconhecido ao salvar.";
        setMsg({ kind: "err", text: errMsg });
        toast.error(errMsg);
        return;
      }
      setMsg({ kind: "ok", text: result.message });
      toast.success(result.message);
      const savedForm = { ...form, slug: s };
      setForm(savedForm);
      setInitialForm(savedForm);
      setInitialSelectedIds(new Set(selectedMatchIds));
      setTimeout(() => setMsg(null), 3000);
    } catch (err: any) {
      setSaving(false);
      const message = err?.message ?? "Erro ao salvar. Tente novamente.";
      console.error("[save] Erro:", message);
      setMsg({ kind: "err", text: message });
      toast.error(message);
    }
  }

  async function copyShare() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  function shareWhatsApp() {
    const text = `🏆⚽ Bora participar do *${form.nome}*! 🇧🇷🔥\n\n🎯 Faça seu palpite agora 👉 ${shareUrl}\n\nBoa sorte! 🍀💚💛`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  const matchesByDate = useMemo(() => {
    const groups = new Map<string, Match[]>();
    for (const m of matches) {
      const d = new Date(m.kickoff_at).toLocaleDateString("pt-BR", {
        weekday: "short",
        day: "2-digit",
        month: "short",
      });
      const arr = groups.get(d) ?? [];
      arr.push(m);
      groups.set(d, arr);
    }
    return Array.from(groups.entries());
  }, [matches]);

  const proximoJogo = matches.find(
    (m) => m.status !== "finished" && new Date(m.kickoff_at) > new Date(Date.now() - 3 * 3600_000),
  );

  function toggleMatch(id: string) {
    setSelectedMatchIds((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }
  function toggleAllVisible() {
    const all = matches.map((m) => m.id);
    const allSelected = all.every((id) => selectedMatchIds.has(id));
    setSelectedMatchIds(allSelected ? new Set() : new Set(all));
  }

  const divulgacaoTexto = useMemo(() => {
    const sel = matches.filter((m) => selectedMatchIds.has(m.id));
    if (sel.length === 0) return "";
    const flagEmoji = flagEmojiFromCode;
    const linhas = sel.map((m) => {
      const h = teams.get(m.home_team_id);
      const a = teams.get(m.away_team_id);
      const dt = new Date(m.kickoff_at).toLocaleString("pt-BR", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
      return `⚽ ${dt}\n${flagEmoji(h?.code)} ${ptTeamName(h?.name) || "?"} 🆚 ${flagEmoji(a?.code)} ${ptTeamName(a?.name) || "?"}`;
    });
    const isUm = sel.length === 1;
    return [
      `🏆🇧🇷 *${form.nome || "Bolão da Copa 2026"}* 🇧🇷🏆`,
      `🔥 O maior bolão entre amigos vai rolar — bora participar? 🤝⚽`,
      ``,
      isUm ? `🎯 Palpite pra este jogão:` : `🎯 Palpite nesses jogaços:`,
      ...linhas,
      ``,
      `💚💛 Regras rápidas:`,
      `• 🥇 Acertou o placar exato = PRÊMIO! 💰`,
      `• ⏱️ Palpites até o apito inicial`,
      `• 📱 Tudo pelo WhatsApp, simples e rápido`,
      form.valor_palpite
        ? `\n💵 Valor: *R$ ${Number(form.valor_palpite).toFixed(2)}* por palpite 💳`
        : "",
      shareUrl ? `\n👉 Entre agora: ${shareUrl}` : "",
      ``,
      `🍀 Boa sorte e que vença o melhor palpiteiro! 🏅🎉`,
    ]
      .filter(Boolean)
      .join("\n");
  }, [matches, selectedMatchIds, teams, form.nome, form.valor_palpite, shareUrl]);


  async function copyDivulgacao() {
    if (!divulgacaoTexto) return;
    await navigator.clipboard.writeText(divulgacaoTexto);
    setDivulgCopied(true);
    setTimeout(() => setDivulgCopied(false), 2000);
  }
  function shareDivulgacaoWhatsApp() {
    if (!divulgacaoTexto) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(divulgacaoTexto)}`, "_blank");
  }

  // ---- Checklist de prontidão ----
  const checks = [
    { ok: !!form.nome, label: "Nome do bolão" },
    { ok: !!form.slug, label: "Link público (slug)" },
    { ok: !!form.regras, label: "Regras definidas" },
    { ok: Number(form.valor_palpite) > 0, label: "Valor do palpite" },
  ];
  const checksOk = checks.filter((c) => c.ok).length;
  const ready = checksOk === checks.length;

  return (
    <div className="max-w-5xl space-y-6 pb-32">
      {/* HERO */}
      <div className="relative overflow-hidden rounded-3xl border border-gold/30 bg-hero p-6 sm:p-8 shadow-card">
        <div className="pointer-events-none absolute inset-0 bg-mesh opacity-70" />
        <div className="pointer-events-none absolute -top-16 -right-10 h-64 w-64 rounded-full bg-gold/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-16 h-72 w-72 rounded-full bg-pitch/30 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-background/40 px-3 py-1 text-xs font-semibold text-gold backdrop-blur">
              <Trophy className="h-3.5 w-3.5" /> Meu bolão
            </span>
            <h1 className="mt-2 font-display text-3xl sm:text-4xl font-black leading-tight tracking-tight">
              {form.nome ? (
                <span className="text-gradient-gold">{form.nome}</span>
              ) : (
                <span className="text-muted-foreground">Sem nome ainda</span>
              )}
            </h1>
            {shareUrl && (
              <a
                href={shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-gold"
              >
                <Eye className="h-3 w-3" /> {shareUrl.replace(/^https?:\/\//, "")}
              </a>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center sm:text-right">
            <Stat
              icon={<DollarSign className="h-3.5 w-3.5" />}
              label="Valor"
              value={`R$ ${Number(form.valor_palpite || 0).toFixed(0)}`}
            />
            <Stat
              icon={<Calendar className="h-3.5 w-3.5" />}
              label="Jogos"
              value={String(selectedMatchIds.size)}
            />
            <Stat
              icon={<Clock className="h-3.5 w-3.5" />}
              label="Limite"
              value={
                form.data_limite_palpite
                  ? new Date(form.data_limite_palpite).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Início do jogo"
              }
            />
          </div>
        </div>
      </div>

      {/* RESUMO DO BOLÃO */}
      <div className="rounded-2xl border border-gold/30 bg-gradient-card p-5 shadow-card">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-gold" />
            <h2 className="font-display text-base font-bold">Resumo do bolão</h2>
          </div>
          {!pixInfo && (
            <Link to="/app/pix" className="inline-flex items-center gap-1 text-xs font-semibold text-gold hover:underline">
              Configurar Pix <ChevronRight className="h-3 w-3" />
            </Link>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryItem label="Nome" value={form.nome || "—"} icon={<Trophy className="h-3.5 w-3.5" />} />
          <SummaryItem
            label="Valor do palpite"
            value={`R$ ${Number(form.valor_palpite || 0).toFixed(2).replace(".", ",")}`}
            icon={<DollarSign className="h-3.5 w-3.5" />}
            highlight
          />
          <SummaryItem
            label="Comissão organizador"
            value={`${Number(form.percentual_admin || 0)}%`}
            hint={`Prêmio: ${100 - Number(form.percentual_admin || 0)}%`}
            icon={<Megaphone className="h-3.5 w-3.5" />}
          />
          <SummaryItem
            label="Pix recebedor"
            value={pixInfo?.nome_recebedor || "Não configurado"}
            hint={pixInfo ? `${(pixInfo.tipo_chave_pix ?? "").toUpperCase()} • ${pixInfo.chave_pix}` : "Configure em Pix"}
            icon={<DollarSign className="h-3.5 w-3.5" />}
          />
        </div>

        {shareUrl && (
          <div className="mt-4 flex flex-col gap-2 rounded-xl border border-border/60 bg-background/40 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Link para compartilhar
              </div>
              <div className="mt-0.5 truncate text-sm font-semibold text-foreground">
                {shareUrl.replace(/^https?:\/\//, "")}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={copyShare}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-card text-xs font-semibold hover:border-gold/40 transition-colors"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-pitch" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copiado" : "Copiar"}
              </button>
              <button
                type="button"
                onClick={shareWhatsApp}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-gradient-gold text-[color:var(--gold-foreground)] text-xs font-black shadow-gold"
              >
                <Share2 className="h-3.5 w-3.5" /> WhatsApp
              </button>
              <a
                href={shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-card text-xs font-semibold hover:border-gold/40 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Abrir
              </a>
            </div>
          </div>
        )}
      </div>



      {/* CHECKLIST DE PRONTIDÃO */}
      {!ready && (
        <div className="rounded-2xl border border-gold/30 bg-card/60 p-4 backdrop-blur shadow-card">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-gold text-[color:var(--gold-foreground)] text-xs font-black shadow-gold">
                {checksOk}/{checks.length}
              </div>
              <div>
                <div className="text-sm font-bold">Termine de configurar para divulgar</div>
                <div className="text-xs text-muted-foreground">
                  Falta(m) {checks.length - checksOk} item(ns) abaixo.
                </div>
              </div>
            </div>
            <button
              onClick={() => setTab("config")}
              className="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-gold hover:underline"
            >
              Ir para configuração <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <ul className="grid gap-1 sm:grid-cols-2 text-xs">
            {checks.map((c) => (
              <li
                key={c.label}
                className={`flex items-center gap-2 ${c.ok ? "text-muted-foreground line-through" : "text-foreground"}`}
              >
                <span
                  className={`grid h-4 w-4 place-items-center rounded-full ${c.ok ? "bg-pitch text-primary-foreground" : "border border-border bg-background"}`}
                >
                  {c.ok && <Check className="h-2.5 w-2.5" />}
                </span>
                {c.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* TABS — 2 only */}
      <nav className="grid grid-cols-2 gap-1 rounded-2xl border border-gold/20 bg-card/60 p-1 backdrop-blur">
        {[
          {
            id: "config" as TabId,
            label: "Configurar",
            icon: <Settings className="h-4 w-4" />,
            desc: "Identidade, regras e prazos",
          },
          {
            id: "divulgar" as TabId,
            label: "Divulgar",
            icon: <Megaphone className="h-4 w-4" />,
            desc: "Link público e WhatsApp",
          },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex flex-col items-start gap-0.5 rounded-xl px-4 py-2.5 text-left transition-all ${
              tab === t.id
                ? "bg-gradient-to-br from-pitch/25 to-transparent ring-1 ring-gold/40 shadow-glow"
                : "hover:bg-card/60"
            }`}
          >
            <span
              className={`inline-flex items-center gap-1.5 text-sm font-bold ${tab === t.id ? "text-gold" : "text-muted-foreground"}`}
            >
              {t.icon} {t.label}
            </span>
            <span className="text-[11px] text-muted-foreground hidden sm:block">{t.desc}</span>
          </button>
        ))}
      </nav>


      {/* TAB: CONFIGURAR */}
      {tab === "config" && (
        <form onSubmit={save} className="space-y-5">
          <Card title="1. Identidade" desc="Como o bolão aparece para os torcedores.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome do bolão">
                <input
                  required
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  className={inputCss}
                  placeholder="Ex.: Bolão da firma"
                />
              </Field>
              <Field
                label="Slug (link público)"
                hint={shareUrl ? `/${form.slug}` : "Aparece em /bolao/..."}
              >
                <input
                  required
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })}
                  className={inputCss}
                />
              </Field>
            </div>
            <Field label="Descrição curta">
              <textarea
                rows={2}
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                className={inputCss}
                placeholder="Aparece no topo da página pública."
              />
            </Field>
          </Card>

          <Card title="2. Regras" desc="Defina pontuação, premiação e condições. Texto livre.">
            <div className="flex items-center justify-end -mt-2 mb-1">
              <button
                type="button"
                onClick={() => setForm({ ...form, regras: SUGESTAO_REGRAS })}
                className="inline-flex items-center gap-1 text-xs font-semibold text-pitch hover:underline"
              >
                <Wand2 className="h-3 w-3" /> Usar sugestão (editável)
              </button>
            </div>
            <textarea
              rows={10}
              value={form.regras}
              onChange={(e) => setForm({ ...form, regras: e.target.value })}
              className={inputCss}
              placeholder={SUGESTAO_REGRAS}
            />
          </Card>

          <Card title="3. Apostas & prazos">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Valor do palpite (R$)">
                <input
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={form.valor_palpite}
                  onChange={(e) => setForm({ ...form, valor_palpite: Number(e.target.value) })}
                  className={inputCss}
                />
              </Field>
              <Field
                label="Percentual da organização (%)"
                hint="Parte do valor arrecadado que o organizador tem direito. O restante vai para o(s) ganhador(es)."
              >
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={form.percentual_admin}
                  onChange={(e) => setForm({ ...form, percentual_admin: Number(e.target.value) })}
                  className={inputCss}
                />
              </Field>
              <Field
                label="Hora limite geral (opcional)"
                hint="Por padrão, os palpites de cada jogo encerram no horário de início (kickoff). Use este campo só para encerrar tudo antes."
              >
                <input
                  type="datetime-local"
                  value={form.data_limite_palpite}
                  onChange={(e) => setForm({ ...form, data_limite_palpite: e.target.value })}
                  className={inputCss}
                />
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  {form.data_limite_palpite && (
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, data_limite_palpite: "" })}
                      className="text-xs font-semibold text-muted-foreground hover:text-foreground hover:underline"
                    >
                      Limpar (usar início de cada jogo)
                    </button>
                  )}
                  {proximoJogo && (
                    <button
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          data_limite_palpite: toDatetimeLocalBR(proximoJogo.kickoff_at),
                        })
                      }
                      className="text-xs font-semibold text-pitch hover:underline"
                    >
                      Usar início do próximo jogo (
                      {new Date(proximoJogo.kickoff_at).toLocaleString("pt-BR")})
                    </button>
                  )}
                </div>
              </Field>
            </div>
          </Card>

          <Card title="4. Visibilidade pública">
            <div className="space-y-2">
              <Toggle
                checked={form.permitir_ranking_publico}
                onChange={(v) => setForm({ ...form, permitir_ranking_publico: v })}
                label="Ranking público"
                desc="Qualquer pessoa com o link vê o ranking."
              />
              <Toggle
                checked={form.permitir_ganhadores_publico}
                onChange={(v) => setForm({ ...form, permitir_ganhadores_publico: v })}
                label="Lista de ganhadores pública"
                desc="Mostrar histórico de premiados na página pública."
              />
            </div>
          </Card>

          {ready && (
            <div className="rounded-2xl border border-green-600/30 bg-green-600/5 p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-green-600" />
                <span className="font-semibold">Tudo pronto! Bora divulgar?</span>
              </div>
              <button
                type="button"
                onClick={() => setTab("divulgar")}
                className="inline-flex h-9 items-center gap-1 rounded-full bg-pitch px-4 text-sm font-bold text-primary-foreground"
              >
                Ir para divulgar <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </form>
      )}

      {/* TAB: DIVULGAR */}
      {tab === "divulgar" && (
        <div className="space-y-5">
          {/* HERO — preview do link */}
          <section className="relative overflow-hidden rounded-2xl border border-pitch/30 bg-gradient-to-br from-pitch/10 via-card to-card p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-wider text-pitch">
                  Seu link público
                </div>
                <div className="mt-1 text-lg font-black truncate">{form.nome || "—"}</div>
                {shareUrl ? (
                  <div className="mt-2 inline-flex max-w-full items-center gap-2 rounded-lg border border-border bg-background/80 px-3 py-1.5 text-xs font-mono break-all">
                    <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="truncate">{shareUrl}</span>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Defina um <b>slug</b> na aba Configurar para gerar o link.
                  </p>
                )}
              </div>
              {shareUrl && (
                <div className="flex flex-col gap-2 sm:items-end">
                  <button
                    type="button"
                    onClick={shareWhatsApp}
                    className={`${btnWhats} h-11 px-5 text-base shadow-md`}
                  >
                    <Share2 className="h-5 w-5" /> Compartilhar no WhatsApp
                  </button>
                  <div className="flex gap-2">
                    <button type="button" onClick={copyShare} className={btnSecondary}>
                      {copied ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}{" "}
                      {copied ? "Copiado!" : "Copiar"}
                    </button>
                    <a
                      href={shareUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={btnSecondary}
                    >
                      <Eye className="h-4 w-4" /> Visualizar
                    </a>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* DIVULGAÇÃO EM MASSA */}
          <Card
            title="Jogos deste bolão"
            desc="Marque os confrontos que farão parte deste link. O criativo público e a prévia do WhatsApp usam exatamente esses jogos. Lembre de Salvar."
            action={
              <div className="flex items-center gap-3">
                {matches.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleAllVisible}
                    className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                  >
                    {matches.every((m) => selectedMatchIds.has(m.id))
                      ? "Limpar"
                      : "Selecionar todos"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={syncWithApi}
                  disabled={syncing}
                  className="inline-flex items-center gap-1 rounded-md border border-gold/40 bg-gold/10 px-2.5 py-1 text-xs font-semibold text-gold hover:bg-gold/20 disabled:opacity-60"
                  title="Buscar jogos e seleções atualizados na API oficial"
                >
                  {syncing ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                  Sincronizar com API
                </button>
              </div>
            }
          >
            {loadingGames ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <Loader2 className="inline h-4 w-4 animate-spin" />
              </div>
            ) : matchesByDate.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum jogo agendado.</p>
            ) : (
              <div className="space-y-4 max-h-[24rem] overflow-y-auto pr-1">
                {matchesByDate.map(([date, ms]) => (
                  <div key={date}>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                      {date}
                    </div>
                    <div className="space-y-1.5">
                      {ms.map((m) => {
                        const home = teams.get(m.home_team_id);
                        const away = teams.get(m.away_team_id);
                        const checked = selectedMatchIds.has(m.id);
                        return (
                          <label
                            key={m.id}
                            className={`flex items-center gap-3 text-sm rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${checked ? "border-pitch bg-pitch/5" : "border-border bg-background hover:border-pitch/40"}`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleMatch(m.id)}
                              className="accent-pitch"
                            />
                            <span className="text-xs font-semibold text-muted-foreground w-12 tabular-nums">
                              {new Date(m.kickoff_at).toLocaleTimeString("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            <span className="flex flex-1 items-center gap-2 min-w-0">
                              <TeamChip team={home} />{" "}
                              <span className="text-muted-foreground">×</span>{" "}
                              <TeamChip team={away} />
                            </span>
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
                <div className="flex items-center gap-2">
                  <Megaphone className="h-4 w-4 text-pitch" />
                  <span className="text-sm font-bold">
                    Prévia ({selectedMatchIds.size} jogo{selectedMatchIds.size > 1 ? "s" : ""})
                  </span>
                </div>
                <textarea
                  readOnly
                  value={divulgacaoTexto}
                  rows={Math.min(14, divulgacaoTexto.split("\n").length + 1)}
                  className={`${inputCss} font-mono text-xs`}
                />
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={copyDivulgacao} className={btnSecondary}>
                    {divulgCopied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}{" "}
                    {divulgCopied ? "Copiado!" : "Copiar texto"}
                  </button>
                  <button type="button" onClick={shareDivulgacaoWhatsApp} className={btnWhats}>
                    <Share2 className="h-4 w-4" /> Enviar no WhatsApp
                  </button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* SAVE BAR */}
      {(tab === "config" || tab === "divulgar") && (
        <div
          className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-30 transition-all ${dirty || msg ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"}`}
        >
          <div className="flex items-center gap-3 rounded-full border border-border bg-card/95 backdrop-blur px-4 py-2 shadow-lg">
            {msg ? (
              <span
                className={`text-sm font-semibold ${msg.kind === "ok" ? "text-green-600" : "text-destructive"}`}
              >
                {msg.text}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">Alterações não salvas</span>
            )}
            <button
              onClick={() => save()}
              disabled={saving || !dirty}
              className="inline-flex h-9 items-center gap-2 rounded-full bg-pitch px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{" "}
              Salvar
            </button>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Torcedores palpitam na{" "}
        <Link
          to="/bolao/$slug"
          params={{ slug: form.slug || "_" }}
          className="text-pitch font-semibold hover:underline"
        >
          página pública
        </Link>
        .
      </p>
    </div>
  );
}

/* ---------- Subcomponents ---------- */

function Card({
  title,
  desc,
  action,
  children,
}: {
  title: string;
  desc?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
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
      <div className="flex items-center justify-center sm:justify-end gap-1 text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 text-sm font-black tabular-nums">{value}</div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  desc,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  desc?: string;
}) {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-border bg-background p-3 cursor-pointer hover:border-pitch/40">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 accent-pitch"
      />
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
      {team?.flag_url ? (
        <img
          src={team.flag_url}
          alt={team.code}
          className="h-4 w-6 object-cover rounded-sm ring-1 ring-border shrink-0"
          loading="lazy"
        />
      ) : (
        <span className="h-4 w-6 rounded-sm bg-muted text-[9px] font-bold grid place-items-center shrink-0">
          {team?.code ?? "?"}
        </span>
      )}
      <span className="truncate font-medium">{ptTeamName(team?.name) || "?"}</span>
    </span>
  );
}

const inputCss =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-pitch/40";
const btnSecondary =
  "inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-semibold hover:border-pitch/40";
const btnWhats =
  "inline-flex h-9 items-center gap-2 rounded-lg bg-green-600 px-3 text-sm font-semibold text-white hover:bg-green-700";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-sm font-medium">
        {label}
        {hint && <span className="text-xs text-muted-foreground font-normal">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
