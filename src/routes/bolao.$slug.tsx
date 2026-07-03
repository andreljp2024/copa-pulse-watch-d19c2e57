import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import confetti from "canvas-confetti";
import { supabase } from "@/integrations/supabase/client";
import { brl, buildWhatsAppLink, interpolate, onlyDigits, LIMITE_PALPITES_FREE, buildDevWhatsAppLink } from "@/lib/saas";
import { maskPhone, isValidWhatsAppBR } from "@/lib/masks";
import { buildPixPayload } from "@/lib/pix";
import { ptTeamName } from "@/components/MatchCard";
import { flagEmoji } from "@/lib/flag";
import { Trophy, MessageCircle, Loader2, Copy, Check, ListOrdered, Clock, Users, Flame, Sparkles, MapPin, Search, Share2, Link as LinkIcon, Medal, Coins } from "lucide-react";
import { formatBR } from "@/lib/timezone";

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
        .select(
          "id, nome, slug, descricao, regras, valor_palpite, status, logo_url, cor_primaria, cor_secundaria, permitir_ranking_publico, permitir_ganhadores_publico, data_limite_palpite, created_at, updated_at",
        )
        .eq("slug", slug)
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      if (!bolao) throw notFound();

      const [bm, t, pay, pc] = await Promise.all([
        supabase.from("bolao_matches").select("match_id").eq("bolao_id", bolao.id),
        supabase.from("teams").select("id, name, code, flag_url"),
        supabase.rpc("get_bolao_public_payment", { p_slug: slug }),
        supabase
          .from("palpites")
          .select("id", { count: "exact", head: true })
          .eq("bolao_id", bolao.id),
      ]);

      const matchIds = (bm.data ?? []).map((r: any) => r.match_id as string);
      let matchesData: Match[] = [];
      if (matchIds.length > 0) {
        const { data: mrows } = await supabase
          .from("matches")
          .select("id, home_team_id, away_team_id, kickoff_at, status, home_score, away_score")
          .in("id", matchIds)
          .order("kickoff_at", { ascending: true });
        matchesData = (mrows ?? []) as Match[];
      }

      const payRow = (pay.data?.[0] ?? null) as
        | {
            nome_recebedor: string | null;
            tipo_chave_pix: string | null;
            chave_pix: string | null;
            banco: string | null;
            valor_padrao_palpite: number | string | null;
            numero_whatsapp: string | null;
            mensagem_novo_palpite: string | null;
            numero_recebedor_whatsapp: string | null;
          }
        | null;

      return {
        bolao,
        matches: matchesData,
        teams: new Map<string, TeamLite>(
          (t.data ?? []).map((x) => [x.id, { name: x.name, code: x.code, flag_url: x.flag_url }]),
        ),
        pix: payRow?.chave_pix
          ? {
              nome_recebedor: payRow.nome_recebedor,
              tipo_chave_pix: (payRow.tipo_chave_pix as "cpf" | "cnpj" | "email" | "telefone" | "aleatoria") || "email",
              chave_pix: payRow.chave_pix,
              banco: payRow.banco,
              valor_padrao_palpite: Number(payRow.valor_padrao_palpite ?? 0),
              numero_recebedor_whatsapp: payRow.numero_recebedor_whatsapp,
            }
          : null,
        wa: payRow?.numero_whatsapp ? { numero_whatsapp: payRow.numero_whatsapp, mensagem_novo_palpite: payRow.mensagem_novo_palpite ?? "Olá! Gostaria de confirmar meu palpite no bolão." } : null,
        totalPalpites: pc.count ?? 0,
      };
    },
    staleTime: 30_000,
  });

export const Route = createFileRoute("/bolao/$slug")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(bolaoPublicOpts(params.slug)),
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [] };
    const now = Date.now() - 3 * 3600_000;
    const next =
      loaderData.matches.find((m) => m.status !== "finished" && m.kickoff_at && new Date(m.kickoff_at).getTime() > now) ??
      loaderData.matches.find((m) => m.status !== "finished") ??
      null;
    const home = next ? loaderData.teams.get(next.home_team_id ?? "") : undefined;
    const away = next ? loaderData.teams.get(next.away_team_id ?? "") : undefined;
    const confronto = home && away ? `${ptTeamName(home.name)} x ${ptTeamName(away.name)}` : "";
    const title = confronto ? `${confronto} — ${loaderData.bolao.nome}` : `${loaderData.bolao.nome} — Bolão Copa 2026`;
    const desc = confronto
      ? `Palpite em ${confronto} e concorra no ${loaderData.bolao.nome}.`
      : (loaderData.bolao.descricao ?? `Participe do ${loaderData.bolao.nome}.`);
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        ...(loaderData.bolao.logo_url ? [{ property: "og:image", content: loaderData.bolao.logo_url }] : []),
      ],
    };
  },
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
  const { bolao, matches, teams, pix, wa, totalPalpites } = data;
  const [selected, setSelected] = useState<Match | null>(null);
  const [step, setStep] = useState<"identidade" | "palpites">("identidade");
  const [form, setForm] = useState({ nome: "", whatsapp: "" });
  const [items, setItems] = useState<Array<{ match_id: string; palpite_a: string; palpite_b: string }>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ link: string; protocolos: string[]; valorTotal: number } | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"abertos" | "ao_vivo" | "encerrados" | "todos">("abertos");
  const [shareCopied, setShareCopied] = useState(false);
  // Evita mismatch de hidratação: `null` durante SSR/1º render, valor real após mount.
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNowMs(Date.now() - 3 * 3600_000);
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  const nowSafe = nowMs ?? 0;

  const ranking = useQuery({
    queryKey: ["bolao", slug, "ranking"],
    queryFn: async () => {
      const { data: r } = await supabase.rpc("get_bolao_ranking", { p_slug: slug });
      return (r ?? []) as Array<{ torcedor_id: string; nome: string; pontos: number; acertos_exatos: number; total: number }>;
    },
    enabled: bolao.permitir_ranking_publico !== false,
    staleTime: 60_000,
  });

  const valorUnit = Number(bolao.valor_palpite) || 0;
  const arrecadado = totalPalpites * valorUnit;
  const premioEstimado = arrecadado * 0.9;

  const openMatches = useMemo(() => {
    const now = nowSafe;
    return matches.filter((m) => {
      const kickoffPassed = m.kickoff_at ? new Date(m.kickoff_at).getTime() <= now : false;
      return !kickoffPassed && m.status !== "live" && m.status !== "finished";
    });
  }, [matches, nowSafe]);

  const filteredMatches = useMemo(() => {
    const now = nowSafe;
    const q = query.trim().toLowerCase();
    return matches.filter((m) => {
      const home = teams.get(m.home_team_id ?? "");
      const away = teams.get(m.away_team_id ?? "");
      const kickoffPassed = m.kickoff_at ? new Date(m.kickoff_at).getTime() <= now : false;
      const isOpen = !kickoffPassed && m.status !== "live" && m.status !== "finished";
      const isLive = m.status === "live";
      const isFinished = m.status === "finished" || kickoffPassed;
      if (statusFilter === "abertos" && !isOpen) return false;
      if (statusFilter === "ao_vivo" && !isLive) return false;
      if (statusFilter === "encerrados" && !isFinished) return false;
      if (q) {
        const hay = `${ptTeamName(home?.name)} ${ptTeamName(away?.name)} ${home?.code ?? ""} ${away?.code ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [matches, teams, query, statusFilter, nowSafe]);

  const valorTotal = items.length * valorUnit;

  function openModal(match: Match | null) {
    const first = match ?? openMatches[0] ?? null;
    setSelected(first);
    setStep("identidade");
    setForm({ nome: "", whatsapp: "" });
    setItems(first ? [{ match_id: first.id, palpite_a: "", palpite_b: "" }] : []);
    setDone(null);
  }

  function setQuantidade(n: number) {
    const qtd = Math.max(1, Math.min(20, n || 1));
    setItems((prev) => {
      const next = prev.slice(0, qtd);
      while (next.length < qtd) {
        const fallback = openMatches[next.length % Math.max(openMatches.length, 1)] ?? openMatches[0];
        next.push({ match_id: fallback?.id ?? "", palpite_a: "", palpite_b: "" });
      }
      return next;
    });
  }


  const featured = useMemo(() => {
    const now = nowSafe;
    return (
      matches.find((m) => m.status !== "finished" && m.kickoff_at && new Date(m.kickoff_at).getTime() > now) ??
      matches.find((m) => m.status !== "finished") ??
      null
    );
  }, [matches, nowSafe]);

  const palpiteAberto = useMemo(() => {
    if (!bolao.data_limite_palpite) return true;
    if (nowMs === null) return true; // SSR-safe padrão
    return new Date(bolao.data_limite_palpite).getTime() > nowSafe;
  }, [bolao.data_limite_palpite, nowMs, nowSafe]);

  function avancarIdentidade(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim() || form.nome.trim().length < 2) {
      alert("Informe seu nome.");
      return;
    }
    if (!isValidWhatsAppBR(form.whatsapp)) {
      alert("WhatsApp inválido. Use DDD + 9 + número (ex.: (11) 99999-9999).");
      return;
    }
    if (items.length === 0) setQuantidade(1);
    setStep("palpites");
  }


  async function submitPalpite(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) return;
    if (totalPalpites + items.length > LIMITE_PALPITES_FREE) {
      const msg = `Olá! Tentei palpitar no bolão *${bolao.nome}* mas ele atingiu o limite de ${LIMITE_PALPITES_FREE} palpites do plano Grátis. Poderia liberar?`;
      const link = buildDevWhatsAppLink(msg);
      alert(
        `Este bolão atingiu o limite de ${LIMITE_PALPITES_FREE} palpites do plano Grátis do Bolão AI.\n\nPeça ao organizador para falar com o Dev no WhatsApp para desbloquear:\n${link}`,
      );
      window.open(link, "_blank", "noopener,noreferrer");
      return;
    }
    if (!pix) {
      alert("Configuração PIX não encontrada. O organizador precisa configurar a chave PIX antes de aceitar palpites.");
      return;
    }
    if (!pix.numero_recebedor_whatsapp) {
      alert("Configuração do WhatsApp do recebedor não encontrada. O organizador precisa configurar o número do recebedor.");
      return;
    }
    const whatsapp = onlyDigits(form.whatsapp);
    setSubmitting(true);
    try {
      const protocolos: string[] = [];
      const linhas: string[] = [];
      for (const it of items) {
        if (!it.match_id) continue;
        const { data: rData, error: rErr } = await supabase.rpc("submit_palpite", {
          p_bolao_id: bolao.id,
          p_nome: form.nome.trim(),
          p_whatsapp: whatsapp,
          p_match_id: it.match_id,
          p_palpite_a: Number(it.palpite_a) || 0,
          p_palpite_b: Number(it.palpite_b) || 0,
        });
        if (rErr) throw rErr;
        const protocolo = Array.isArray(rData) && rData[0]?.codigo
          ? `BOL-${String(rData[0].codigo).padStart(4, "0")}`
          : "—";
        protocolos.push(protocolo);
        const m = matches.find((x) => x.id === it.match_id);
        const home = teams.get(m?.home_team_id ?? "");
        const away = teams.get(m?.away_team_id ?? "");
        const fa = flagEmoji(home?.code);
        const fb = flagEmoji(away?.code);
        linhas.push(`• ${fa} ${ptTeamName(home?.name)} ${it.palpite_a} x ${it.palpite_b} ${ptTeamName(away?.name)} ${fb}  (${protocolo})`);
      }

      const dataHora = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
      const protocolosStr = protocolos.join(", ");
      const msg =
        `👤 Eu: ${form.nome}\n` +
        `📱 Whatsapp: ${maskPhone(whatsapp)}\n` +
        `📅 ${dataHora}\n\n` +
        `⚽ Acabei de registrar um palpite\n` +
        `🏆 Em: *${bolao.nome}*\n\n` +
        `${linhas.join("\n")}\n\n` +
        `🎯 Protocolo(s): ${protocolosStr}\n` +
        `💰 Total: *${brl(valorTotal)}*\n\n` +
        `💳 Já lhe envio o comprovante\n` +
        `🏦 Para: ${pix.chave_pix}`;
      setDone({ link: buildWhatsAppLink(pix.numero_recebedor_whatsapp ?? "", msg), protocolos, valorTotal });
      (confetti as unknown as (opts: Record<string, unknown>) => void)({ particleCount: 120, spread: 80, origin: { y: 0.6 }, useWorker: false, disableForReducedMotion: true });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao enviar palpite");
    } finally {
      setSubmitting(false);
    }
  }

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  async function copyShare() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch { /* noop */ }
  }
  const shareWa = `https://wa.me/?text=${encodeURIComponent(`🏆⚽ Participe do bolão *${bolao.nome}* — palpite na Copa 2026! 🇧🇷🔥\n\n👉 ${shareUrl}\n\nBoa sorte! 🍀💚💛`)}`;


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

      <div className="mx-auto max-w-5xl px-4 pt-4 flex items-center justify-between gap-3 flex-wrap print:hidden">
        <div className="flex items-center gap-2 flex-wrap">
          <Link to="/bolao/$slug/ranking" params={{ slug: bolao.slug }} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gold/30 bg-card text-sm font-semibold text-gold hover:border-gold/60 transition-colors">
            <ListOrdered className="h-4 w-4" /> Ranking
          </Link>
          <button type="button" onClick={copyShare} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-card text-sm font-semibold hover:border-gold/40 transition-colors" aria-label="Copiar link do bolão">
            {shareCopied ? <Check className="h-4 w-4 text-pitch" /> : <LinkIcon className="h-4 w-4" />}
            {shareCopied ? "Copiado!" : "Copiar link"}
          </button>
          <a href={shareWa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-card text-sm font-semibold hover:border-gold/40 transition-colors">
            <Share2 className="h-4 w-4" /> Compartilhar
          </a>
        </div>
        <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5 text-gold" />
          <span><strong className="text-foreground">{totalPalpites}</strong> palpites registrados</span>
        </div>
      </div>

      {/* Prêmio estimado + ranking ao vivo */}
      <section className="mx-auto max-w-5xl px-4 pt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-gold/30 bg-gradient-card p-5 card-elevated">
          <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gold">
            <Coins className="h-3.5 w-3.5" /> Prêmio estimado
          </div>
          <div className="mt-2 font-display text-3xl sm:text-4xl font-black text-gradient-samba">{brl(premioEstimado)}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Arrecadação atual: <strong className="text-foreground">{brl(arrecadado)}</strong> · {totalPalpites} palpite(s) · 90% para premiação
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 card-elevated">
          <div className="flex items-center justify-between mb-3">
            <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gold">
              <Medal className="h-3.5 w-3.5" /> Ranking ao vivo
            </div>
            <Link to="/bolao/$slug/ranking" params={{ slug: bolao.slug }} className="text-[11px] font-semibold text-gold hover:underline">Ver tudo →</Link>
          </div>
          {bolao.permitir_ranking_publico === false ? (
            <p className="text-xs text-muted-foreground">Ranking não disponível publicamente.</p>
          ) : ranking.isLoading ? (
            <p className="text-xs text-muted-foreground inline-flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Calculando…</p>
          ) : (ranking.data ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem pontuações ainda. Seja o primeiro a acertar!</p>
          ) : (
            <ol className="space-y-1.5">
              {(ranking.data ?? []).slice(0, 5).map((r, i) => (
                <li key={r.torcedor_id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="inline-flex items-center gap-2 min-w-0">
                    <span className={`h-6 w-6 rounded-full grid place-items-center text-[10px] font-black ${i === 0 ? "bg-gradient-gold text-black" : "bg-muted text-foreground"}`}>{i + 1}</span>
                    <span className="truncate">{r.nome}</span>
                  </span>
                  <span className="font-black tabular-nums text-gold">{r.pontos} pts</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

{featured && pix && pix.numero_recebedor_whatsapp && (
         <section className="mx-auto max-w-5xl px-4 pt-6 print:hidden">
           <FeaturedMatchCard
             match={featured}
             home={teams.get(featured.home_team_id ?? "")}
             away={teams.get(featured.away_team_id ?? "")}
             valor={Number(bolao.valor_palpite)}
             palpiteAberto={palpiteAberto}
             pix={pix}
             onPalpitar={() => openModal(featured)}
           />
         </section>
        )}

        {(!pix || !pix.numero_recebedor_whatsapp) && (
         <section className="mx-auto max-w-5xl px-4 pt-6 print:hidden">
           <div className="rounded-2xl border border-border bg-card p-5 text-center">
             <p className="text-sm text-muted-foreground">
               {!pix ? "PIX não configurado" : "WhatsApp não configurado"}
             </p>
           </div>
         </section>
        )}

      <main className="mx-auto max-w-5xl px-4 py-8 space-y-8">
        {bolao.regras && (
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-bold mb-2">Regras</h2>
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">{bolao.regras}</p>
          </section>
        )}

        <section>
          <div className="flex items-end justify-between gap-3 flex-wrap mb-4">
            <h2 className="font-display text-2xl sm:text-3xl font-black uppercase tracking-wide flex items-center gap-3">
              <span className="inline-block h-6 w-1 bg-gradient-samba rounded-sm" aria-hidden="true" />
              Jogos
            </h2>
            <div className="flex items-center gap-2 print:hidden">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar seleção…"
                  className="h-9 pl-8 pr-3 rounded-lg border border-border bg-background text-sm w-44 focus:outline-none focus:ring-2 focus:ring-gold"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="h-9 rounded-lg border border-border bg-background px-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-gold"
                aria-label="Filtrar por status"
              >
                <option value="abertos">Abertos</option>
                <option value="ao_vivo">Ao vivo</option>
                <option value="encerrados">Encerrados</option>
                <option value="todos">Todos</option>
              </select>
            </div>
          </div>
          {!palpiteAberto && (
            <p className="mb-3 text-sm font-semibold text-live bg-live/10 border border-live/30 rounded-lg p-3">
              ⏰ Período de palpites encerrado.
            </p>
          )}
          {matches.length === 0 ? (
            <p className="mb-3 text-sm text-muted-foreground bg-card border border-border rounded-lg p-4 text-center">
              O organizador ainda não vinculou jogos a este bolão.
            </p>
          ) : filteredMatches.length === 0 ? (
            <p className="mb-3 text-sm text-muted-foreground bg-card border border-border rounded-lg p-4 text-center">
              Nenhum jogo encontrado com os filtros atuais.
            </p>
          ) : null}
          <div className="grid gap-2">
            {filteredMatches.slice(0, 60).map((m) => {
              const home = teams.get(m.home_team_id ?? "");
              const away = teams.get(m.away_team_id ?? "");
              const kickoffPassed = m.kickoff_at ? new Date(m.kickoff_at).getTime() <= nowSafe : false;
              const matchOpen = palpiteAberto && !kickoffPassed && m.status !== "live" && m.status !== "finished";
              return (
                <div key={m.id} className="rounded-xl border border-border bg-gradient-card p-3 flex items-center gap-3 card-elevated transition-colors hover:border-gold/40">
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    {home?.flag_url && <img src={home.flag_url} alt="" className="h-5 w-7 object-cover rounded" />}
                    <span className="font-medium truncate">{ptTeamName(home?.name) || "?"}</span>
                    <span className="text-muted-foreground text-sm mx-2">x</span>
                    <span className="font-medium truncate">{ptTeamName(away?.name) || "?"}</span>
                    {away?.flag_url && <img src={away.flag_url} alt="" className="h-5 w-7 object-cover rounded" />}
                    {m.kickoff_at && (
                      <span className="hidden sm:inline ml-3 text-[11px] text-muted-foreground">
                        {format(new Date(m.kickoff_at), "dd/MM HH:mm", { locale: ptBR })}
                      </span>
                    )}
                  </div>
                  {m.status === "finished" ? (
                    <span className="text-sm font-black tabular-nums text-gold">{m.home_score} x {m.away_score}</span>
                  ) : matchOpen ? (
                    <button onClick={() => openModal(m)} className="text-sm font-bold uppercase tracking-wide text-gold hover:underline print:hidden">Fazer palpite →</button>
                  ) : (
                    <span className="text-xs text-muted-foreground">{m.status === "live" ? "Em andamento" : "Encerrado"}</span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm grid place-items-center p-4 overflow-y-auto" onClick={() => setSelected(null)}>
          <div className="bg-gradient-card border border-border rounded-2xl max-w-md w-full p-6 card-elevated ring-conic my-8" onClick={(e) => e.stopPropagation()}>
            {done ? (
              <SuccessPanel waLink={done.link} protocolos={done.protocolos} pix={pix!} valor={done.valorTotal} onClose={() => setSelected(null)} />
            ) : step === "identidade" ? (
              <form onSubmit={avancarIdentidade} className="space-y-3">
                <h3 className="font-display text-2xl font-black uppercase">Seu palpite</h3>
                <p className="text-sm text-muted-foreground">Comece com seus dados. Em seguida você escolhe quantos palpites quer fazer.</p>
                <input required placeholder="Seu nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold" />
                <div>
                  <input
                    required
                    inputMode="tel"
                    placeholder="(11) 99999-9999"
                    value={maskPhone(form.whatsapp)}
                    onChange={(e) => setForm({ ...form, whatsapp: onlyDigits(e.target.value).slice(0, 11) })}
                    aria-invalid={form.whatsapp.length > 0 && !isValidWhatsAppBR(form.whatsapp)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold aria-[invalid=true]:border-destructive"
                  />
                  {form.whatsapp.length > 0 && !isValidWhatsAppBR(form.whatsapp) && (
                    <p className="mt-1 text-xs text-destructive">WhatsApp inválido — use DDD + 9 + número.</p>
                  )}
                  {isValidWhatsAppBR(form.whatsapp) && (
                    <p className="mt-1 text-xs text-primary">✓ WhatsApp válido</p>
                  )}
                </div>
                <button
                  disabled={!isValidWhatsAppBR(form.whatsapp) || !form.nome.trim()}
                  className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-gold font-black uppercase tracking-wide text-black shadow-gold transition-transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  Continuar →
                </button>

                <button type="button" onClick={() => setSelected(null)} className="block w-full text-sm text-muted-foreground hover:underline">Cancelar</button>
              </form>
            ) : (
              <form onSubmit={submitPalpite} className="space-y-4">
                <h3 className="font-display text-2xl font-black uppercase">Seus palpites</h3>
                <p className="text-xs text-muted-foreground">Olá, <strong className="text-foreground">{form.nome}</strong> — quantos palpites quer fazer?</p>

                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Quantidade</label>
                  <button
                    type="button"
                    onClick={() => setQuantidade(items.length - 1)}
                    className="h-8 w-8 rounded-lg border border-border bg-background text-sm font-black transition-colors hover:border-gold disabled:opacity-40"
                    disabled={items.length <= 1}
                    aria-label="Diminuir quantidade de palpites"
                  >
                    −
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={items.length}
                    onChange={(e) => setQuantidade(Number(onlyDigits(e.target.value)))}
                    className="w-20 rounded-lg border border-border bg-background px-2 py-1.5 text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-gold"
                    aria-label="Quantidade de palpites"
                  />
                  <button
                    type="button"
                    onClick={() => setQuantidade(items.length + 1)}
                    className="h-8 w-8 rounded-lg border border-border bg-background text-sm font-black transition-colors hover:border-gold disabled:opacity-40"
                    disabled={items.length >= 20}
                    aria-label="Aumentar quantidade de palpites"
                  >
                    +
                  </button>
                  <span className="text-xs text-muted-foreground">{openMatches.length} jogo(s) aberto(s)</span>

                </div>

                <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
                  {items.map((it, idx) => {
                    const m = matches.find((x) => x.id === it.match_id);
                    const home = teams.get(m?.home_team_id ?? "");
                    const away = teams.get(m?.away_team_id ?? "");
                    return (
                      <div key={idx} className="rounded-xl border border-border bg-background/60 p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-gold">Palpite {idx + 1}</span>
                          <span className="text-[10px] text-muted-foreground">{brl(valorUnit)}</span>
                        </div>
                        <select
                          value={it.match_id}
                          onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, match_id: e.target.value } : x))}
                          className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold"
                        >
                          {openMatches.map((om) => {
                            const h = teams.get(om.home_team_id ?? "");
                            const a = teams.get(om.away_team_id ?? "");
                            return <option key={om.id} value={om.id}>{ptTeamName(h?.name)} x {ptTeamName(a?.name)}</option>;
                          })}
                        </select>
                        <div className="flex items-end gap-3 justify-center">
                          <label className="flex flex-col items-center gap-1.5">
                            {home?.flag_url ? (
                              <img src={home.flag_url} alt={ptTeamName(home?.name)} className="h-10 w-14 object-cover rounded-md ring-1 ring-gold/40" />
                            ) : (
                              <div className="h-10 w-14 rounded-md bg-muted grid place-items-center text-xs font-black">{home?.code ?? "?"}</div>
                            )}
                            <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground max-w-[6rem] truncate">{ptTeamName(home?.name)}</span>
                            <input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="–" required value={it.palpite_a} onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, palpite_a: onlyDigits(e.target.value).slice(0, 2) } : x))} className="w-16 text-center text-xl font-black tabular-nums rounded-lg border border-border bg-background py-1.5 text-gold focus:outline-none focus:ring-2 focus:ring-gold" />
                          </label>
                          <span className="font-bold text-muted-foreground pb-8">x</span>
                          <label className="flex flex-col items-center gap-1.5">
                            {away?.flag_url ? (
                              <img src={away.flag_url} alt={ptTeamName(away?.name)} className="h-10 w-14 object-cover rounded-md ring-1 ring-gold/40" />
                            ) : (
                              <div className="h-10 w-14 rounded-md bg-muted grid place-items-center text-xs font-black">{away?.code ?? "?"}</div>
                            )}
                            <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground max-w-[6rem] truncate">{ptTeamName(away?.name)}</span>
                            <input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="–" required value={it.palpite_b} onChange={(e) => setItems(items.map((x, i) => i === idx ? { ...x, palpite_b: onlyDigits(e.target.value).slice(0, 2) } : x))} className="w-16 text-center text-xl font-black tabular-nums rounded-lg border border-border bg-background py-1.5 text-gold focus:outline-none focus:ring-2 focus:ring-gold" />
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="rounded-xl border border-gold/30 bg-gold/10 p-3 text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">{items.length} × {brl(valorUnit)}</span><span className="font-bold text-foreground">{brl(valorTotal)}</span></div>
                  {pix && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Chave Pix</span>
                      <span className="font-mono text-foreground truncate max-w-[14rem]">{pix.chave_pix}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-1 border-t border-gold/20"><span className="font-black uppercase text-xs text-gold">Total Pix</span><span className="font-black text-gold">{brl(valorTotal)}</span></div>
                </div>
                <button type="submit" disabled={submitting} className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-gold font-black uppercase tracking-wide text-black shadow-gold transition-transform hover:scale-[1.02] disabled:opacity-60">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : `Confirmar ${items.length} palpite(s)`}
                </button>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setStep("identidade")} className="flex-1 text-sm text-muted-foreground hover:underline">← Voltar</button>
                  <button type="button" onClick={() => setSelected(null)} className="flex-1 text-sm text-muted-foreground hover:underline">Cancelar</button>
                </div>
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
  protocolos,
  pix,
  valor,
  onClose,
}: {
  waLink: string;
  protocolos: string[];
  pix: { nome_recebedor: string | null; tipo_chave_pix: "cpf" | "cnpj" | "email" | "telefone" | "aleatoria"; chave_pix: string; banco: string | null };
  valor: number;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const formattedChave = pix.tipo_chave_pix === "telefone"
    ? `+55${onlyDigits(pix.chave_pix)}`
    : pix.tipo_chave_pix === "cpf" || pix.tipo_chave_pix === "cnpj"
      ? onlyDigits(pix.chave_pix)
      : pix.chave_pix;
  const payload = useMemo(
    () => buildPixPayload({ chave: formattedChave, nomeRecebedor: pix.nome_recebedor ?? "", valor }),
    [formattedChave, pix.nome_recebedor, valor],
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
      <h3 className="font-display text-2xl font-black uppercase text-gradient-samba">Palpite registrado!</h3>
      <div className="inline-block rounded-lg bg-gold/15 border border-gold/30 px-3 py-1 text-xs font-bold text-gold">Palpite(s): {protocolos.join(", ")}</div>
      <p className="text-sm text-muted-foreground">Guarde esse número para consultas. Pague o Pix e envie o comprovante pelo WhatsApp.</p>

      <div className="bg-white p-3 rounded-xl border border-border inline-block shadow-gold">
        <QRCodeSVG value={payload} size={180} />
      </div>
      <div className="text-xs text-muted-foreground">{pix.nome_recebedor} • <span className="text-gold font-semibold">{brl(valor)}</span></div>

      <button
        type="button"
        onClick={copyPix}
        className={`w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl border font-bold text-sm transition-colors ${
          copied
            ? "bg-background border-border text-foreground"
            : "animate-attn-pix border-transparent"
        }`}
      >
        {copied ? <Check className="h-4 w-4 text-pitch" /> : <Copy className="h-4 w-4" />}
        {copied ? "Copiado!" : "Copiar Pix copia e cola"}
      </button>

      <a href={waLink} target="_blank" rel="noopener noreferrer" className="w-full inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-pitch px-5 font-black uppercase tracking-wide text-primary-foreground shadow-glow transition-transform hover:scale-[1.02]">
        <MessageCircle className="h-5 w-5" /> Abrir WhatsApp
      </a>
      <button onClick={onClose} className="block w-full text-sm text-muted-foreground hover:underline">Fechar</button>
    </div>
  );
}

function useCountdown(target: string | null) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!target) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);
  if (!target || now === null) return null;
  const diff = new Date(target).getTime() - now;
  if (diff <= 0) return { d: 0, h: 0, m: 0, s: 0, live: true };
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return { d, h, m, s, live: false };
}

function FeaturedMatchCard({
  match,
  home,
  away,
  valor,
  palpiteAberto,
  pix,
  onPalpitar,
}: {
  match: Match;
  home?: TeamLite;
  away?: TeamLite;
  valor: number;
  palpiteAberto: boolean;
  pix: { nome_recebedor: string | null; tipo_chave_pix: "cpf" | "cnpj" | "email" | "telefone" | "aleatoria"; chave_pix: string; banco: string | null; numero_recebedor_whatsapp: string | null } | null;
  onPalpitar: () => void;
}) {
  const cd = useCountdown(match.kickoff_at);
  const isLive = match.status === "live";
  // cd é null durante SSR/1º render; só considera kickoff passado após o mount para evitar mismatch de hidratação
  const kickoffPassed = cd ? cd.live : false;
  const podePalpitar = !kickoffPassed && palpiteAberto && !isLive && match.status !== "finished" && !!pix && !!pix.numero_recebedor_whatsapp;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-gold/30 bg-gradient-card shadow-gold ring-conic">
      {/* Background flags */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.12]" aria-hidden="true">
        {home?.flag_url && (
          <img src={home.flag_url} alt="" className="absolute -left-10 top-1/2 -translate-y-1/2 h-[140%] w-auto blur-sm" />
        )}
        {away?.flag_url && (
          <img src={away.flag_url} alt="" className="absolute -right-10 top-1/2 -translate-y-1/2 h-[140%] w-auto blur-sm" />
        )}
      </div>
      <div
        aria-hidden="true"
        className="absolute -top-24 left-1/2 -translate-x-1/2 h-72 w-72 rounded-full opacity-30 blur-3xl"
        style={{ backgroundImage: "var(--gradient-conic-gold)" }}
      />

      <div className="relative p-5 sm:p-7">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
          <div className="inline-flex items-center gap-2 rounded-full bg-gold/15 border border-gold/30 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-gold">
            <Flame className="h-3 w-3" /> Próximo jogo em destaque
          </div>
          {isLive ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-live/15 border border-live/40 text-live text-[10px] font-black uppercase">
              <span className="live-dot h-2 w-2 rounded-full" /> Ao vivo
            </span>
          ) : (
            match.kickoff_at && (
              <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                {format(new Date(match.kickoff_at), "EEE, dd MMM • HH:mm", { locale: ptBR })}
              </span>
            )
          )}
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
          <div className="flex flex-col items-center gap-2 text-center min-w-0">
            {home?.flag_url ? (
              <img src={home.flag_url} alt={ptTeamName(home.name)} className="h-16 w-24 sm:h-20 sm:w-28 object-cover rounded-md ring-2 ring-gold/40 shadow-card" />
            ) : (
              <div className="h-16 w-24 sm:h-20 sm:w-28 rounded-md bg-muted grid place-items-center font-black text-xl">{home?.code ?? "?"}</div>
            )}
            <div className="font-display font-black uppercase text-sm sm:text-base truncate w-full">{ptTeamName(home?.name) || "—"}</div>
          </div>

          <div className="text-center">
            <div className="font-display text-3xl sm:text-5xl font-black text-gradient-samba leading-none">VS</div>
            <div className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">Copa 2026</div>
          </div>

          <div className="flex flex-col items-center gap-2 text-center min-w-0">
            {away?.flag_url ? (
              <img src={away.flag_url} alt={ptTeamName(away.name)} className="h-16 w-24 sm:h-20 sm:w-28 object-cover rounded-md ring-2 ring-gold/40 shadow-card" />
            ) : (
              <div className="h-16 w-24 sm:h-20 sm:w-28 rounded-md bg-muted grid place-items-center font-black text-xl">{away?.code ?? "?"}</div>
            )}
            <div className="font-display font-black uppercase text-sm sm:text-base truncate w-full">{ptTeamName(away?.name) || "—"}</div>
          </div>
        </div>

        {/* Countdown */}
        {cd && !cd.live && !isLive && match.status !== "finished" && (
          <div className="mt-6 grid grid-cols-4 gap-2 max-w-md mx-auto">
            {[
              { v: cd.d, l: "dias" },
              { v: cd.h, l: "horas" },
              { v: cd.m, l: "min" },
              { v: cd.s, l: "seg" },
            ].map((b) => (
              <div key={b.l} className="rounded-xl bg-background/60 border border-gold/20 backdrop-blur py-2 text-center">
                <div className="font-display text-xl sm:text-2xl font-black tabular-nums text-gold">{String(b.v).padStart(2, "0")}</div>
                <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{b.l}</div>
              </div>
            ))}
          </div>
        )}

        {/* CTA & stats */}
        <div className="mt-6 grid sm:grid-cols-[1fr_auto] items-center gap-4">
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-gold" /> Aposta única: <strong className="text-gold">{brl(valor)}</strong>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-gold" /> Mundial FIFA
            </span>
          </div>
{podePalpitar ? (
             <button
               onClick={onPalpitar}
               className="h-12 px-6 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-gold font-black uppercase tracking-wide text-black shadow-gold transition-transform hover:scale-[1.03]"
             >
               <Trophy className="h-4 w-4" /> Fazer meu palpite
             </button>
           ) : (
             <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
               {isLive ? "Jogo em andamento" : !pix ? "PIX não configurado" : !pix.numero_recebedor_whatsapp ? "WhatsApp não configurado" : "Palpites encerrados"}
             </span>
           )}
        </div>
      </div>
    </div>
  );
}
