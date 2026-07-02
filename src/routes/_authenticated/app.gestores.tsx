import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { formatBRDateOnly, formatBRShort } from "@/lib/timezone";
import {
  Shield,
  UserPlus,
  Pause,
  Play,
  Trash2,
  Mail,
  CreditCard,
  Search,
  MoreVertical,
  KeyRound,
  Send,
  Eye,
  CheckCircle2,
  XCircle,
  ShieldPlus,
  ShieldMinus,
  Copy,
  Share2,
  ChevronDown,
  MessageCircle,
} from "lucide-react";
import {
  isSuperAdmin,
  listGestores,
  inviteGestor,
  updateGestorStatus,
  deleteGestor,
  listPlanosAdmin,
  changeGestorPlano,
  getGestorDetail,
  resetGestorPassword,
  resendGestorInvite,
  grantGestorRole,
  revokeGestorRole,
} from "@/lib/gestores.functions";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated/app/gestores")({
  head: () => ({ meta: [{ title: "Organizadores — Bolão AI" }] }),
  component: GestoresPage,
});

function GestoresPage() {
  const navigate = useNavigate();
  const checkFn = useServerFn(isSuperAdmin);
  const { data: check, isLoading: checking } = useQuery({
    queryKey: ["isSuperAdmin"],
    queryFn: () => checkFn(),
  });

  if (checking) return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;

  if (!check?.isSuperAdmin) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <Shield className="h-10 w-10 mx-auto text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-black">Acesso restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Apenas super administradores podem acessar este módulo.
        </p>
        <button
          onClick={() => navigate({ to: "/app" })}
          className="mt-4 h-10 px-4 rounded-lg border border-border text-sm font-semibold"
        >
          Voltar
        </button>
      </div>
    );
  }

  return <GestoresInner />;
}

type StatusFilter = "all" | "active" | "suspended";

function GestoresInner() {
  const qc = useQueryClient();
  const listFn = useServerFn(listGestores);
  const planosFn = useServerFn(listPlanosAdmin);
  const inviteFn = useServerFn(inviteGestor);
  const statusFn = useServerFn(updateGestorStatus);
  const deleteFn = useServerFn(deleteGestor);
  const changePlanoFn = useServerFn(changeGestorPlano);
  const resetPwdFn = useServerFn(resetGestorPassword);
  const resendInviteFn = useServerFn(resendGestorInvite);
  const grantRoleFn = useServerFn(grantGestorRole);
  const revokeRoleFn = useServerFn(revokeGestorRole);


  const { data: gestores = [], isLoading } = useQuery({
    queryKey: ["gestores"],
    queryFn: () => listFn(),
  });
  const { data: planos = [] } = useQuery({ queryKey: ["planos-admin"], queryFn: () => planosFn() });

  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: "", nome_responsavel: "", nome_estabelecimento: "" });
  const [planoEdit, setPlanoEdit] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [planoFilter, setPlanoFilter] = useState<string>("all");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; nome: string } | null>(null);
  const [confirmSuspend, setConfirmSuspend] = useState<any | null>(null);
  const [recoveryLink, setRecoveryLink] = useState<{ email: string; link: string | null } | null>(
    null,
  );

  const invalidate = () => qc.invalidateQueries({ queryKey: ["gestores"] });
  const notify = (text: string, kind: "ok" | "err" = "ok") => setMsg({ kind, text });

  const invite = useMutation({
    mutationFn: (d: typeof form) => inviteFn({ data: d }),
    onSuccess: () => {
      notify("Convite enviado com sucesso.");
      setForm({ email: "", nome_responsavel: "", nome_estabelecimento: "" });
      setShowForm(false);
      invalidate();
    },
    onError: (e: any) => notify(e?.message ?? "Falha ao convidar.", "err"),
  });

  const toggleStatus = useMutation({
    mutationFn: (g: any) =>
      statusFn({
        data: { tenant_id: g.id, status: g.status === "active" ? "suspended" : "active" },
      }),
    onSuccess: () => {
      notify("Status atualizado.");
      invalidate();
    },
    onError: (e: any) => notify(e?.message ?? "Falha ao atualizar.", "err"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { tenant_id: id, delete_auth_user: true } }),
    onSuccess: () => {
      notify("Organizador removido.");
      invalidate();
      setConfirmDelete(null);
    },
    onError: (e: any) => {
      notify(e?.message ?? "Falha ao remover.", "err");
      setConfirmDelete(null);
    },
  });

  const changePlano = useMutation({
    mutationFn: (d: { tenant_id: string; plano_id: string }) => changePlanoFn({ data: d }),
    onSuccess: (r: any) => {
      notify(`Plano alterado para ${r.plano}.`);
      invalidate();
    },
    onError: (e: any) => notify(e?.message ?? "Falha ao alterar plano.", "err"),
  });

  const resetPwd = useMutation({
    mutationFn: (id: string) => resetPwdFn({ data: { tenant_id: id } }),
    onSuccess: (r: any) => {
      notify(`Link de redefinição gerado para ${r.email}.`);
      setRecoveryLink({ email: r.email, link: r.action_link ?? null });
    },
    onError: (e: any) => notify(e?.message ?? "Falha ao enviar link.", "err"),
  });

  const resendInvite = useMutation({
    mutationFn: (id: string) => resendInviteFn({ data: { tenant_id: id } }),
    onSuccess: (r: any) => notify(`Convite reenviado para ${r.email}.`),
    onError: (e: any) => notify(e?.message ?? "Falha ao reenviar convite.", "err"),
  });

  const grantRole = useMutation({
    mutationFn: (d: { tenant_id: string; role: "super_admin" | "admin" }) =>
      grantRoleFn({ data: d }),
    onSuccess: (_r, v) => {
      notify(`Papel ${v.role} concedido.`);
      invalidate();
    },
    onError: (e: any) => notify(e?.message ?? "Falha ao conceder papel.", "err"),
  });

  const revokeRole = useMutation({
    mutationFn: (d: { tenant_id: string; role: "super_admin" | "admin" }) =>
      revokeRoleFn({ data: d }),
    onSuccess: (_r, v) => {
      notify(`Papel ${v.role} removido.`);
      invalidate();
    },
    onError: (e: any) => notify(e?.message ?? "Falha ao remover papel.", "err"),
  });


  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (gestores as any[]).filter((g) => {
      if (statusFilter !== "all" && g.status !== statusFilter) return false;
      if (planoFilter !== "all" && g.plano !== planoFilter) return false;
      if (!q) return true;
      return [g.nome_estabelecimento, g.nome_responsavel, g.email, g.whatsapp, g.cidade]
        .filter(Boolean)
        .some((v: string) => v.toLowerCase().includes(q));
    });
  }, [gestores, query, statusFilter, planoFilter]);

  const planoNames = useMemo(
    () => Array.from(new Set((gestores as any[]).map((g) => g.plano).filter(Boolean))),
    [gestores],
  );

  const totals = useMemo(() => {
    const all = gestores as any[];
    return {
      total: all.length,
      ativos: all.filter((g) => g.status === "active").length,
      suspensos: all.filter((g) => g.status === "suspended").length,
      semLogin: all.filter((g) => !g.last_sign_in_at).length,
    };
  }, [gestores]);

  return (
    <div className="space-y-6">
      {/* Hero verde-amarelo — espírito do Hexa */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-hero p-6 shadow-lg">
        <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:var(--gradient-mesh)]" />
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gradient-gold blur-3xl opacity-30" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-gradient-pitch blur-3xl opacity-30" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-background/40 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-gold backdrop-blur">
              <Shield className="h-3 w-3" /> Painel do Super Admin · Rumo ao Hexa 🇧🇷
            </div>
            <h1 className="mt-3 font-display text-3xl font-black tracking-tight sm:text-4xl">
              Organizadores de <span className="text-gradient-gold">Bolão</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Comanda o time de organizadores com a garra da torcida brasileira.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(() => {
              const url =
                typeof window !== "undefined"
                  ? `${window.location.origin}/criar-bolao`
                  : "https://copa-pulse-watch.lovable.app/criar-bolao";
              const msg =
                `🏆⚽ *BOLÃO AI — RUMO AO HEXA* 🇧🇷💚💛\n` +
                `━━━━━━━━━━━━━━━━━━━━\n\n` +
                `👋 E aí, craque! Bora ser o *organizador oficial* do bolão da sua turma na *Copa 2026*? 🎉\n\n` +
                `🎁 *É cortesia do Dev* — não é bets 🚫🎰\n` +
                `🤝 Só torcida entre amigos, família e colegas de trabalho.\n\n` +
                `✨ *O QUE VOCÊ GANHA:*\n` +
                `📱 Palpites 100% pelo WhatsApp\n` +
                `💰 Pix cai *direto na sua conta*\n` +
                `🏅 Ranking e ganhadores no automático\n` +
                `📊 Painel completo pra gerenciar tudo\n` +
                `🆓 *Grátis até 50 palpites* — todos os recursos liberados\n\n` +
                `⚡ *COMO COMEÇAR (leva 2 min):*\n` +
                `1️⃣ Clique no link abaixo\n` +
                `2️⃣ Crie o seu bolão\n` +
                `3️⃣ Compartilhe com a galera 🚀\n\n` +
                `👇 *Crie o seu bolão agora:*\n${url}\n\n` +
                `━━━━━━━━━━━━━━━━━━━━\n` +
                `Bora torcer juntos pelo *HEXA*! 🇧🇷🥅🔥`;
              const shareLink = `https://wa.me/?text=${encodeURIComponent(msg)}`;
              return (
                <a
                  href={shareLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex h-11 items-center gap-2 rounded-xl bg-[#25D366] px-5 text-sm font-black text-white shadow-md transition-transform hover:scale-105"
                  title="Divulgar a plataforma no WhatsApp"
                >
                  <Share2 className="h-4 w-4 transition-transform group-hover:rotate-12" />
                  📣 Divulgar no WhatsApp
                </a>
              );
            })()}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="group inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-gold px-5 text-sm font-black text-primary-foreground shadow-md transition-transform hover:scale-105">
                  <UserPlus className="h-4 w-4 transition-transform group-hover:rotate-12" /> Novo organizador <ChevronDown className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => setShowForm(true)}>
                  <Mail className="mr-2 h-4 w-4" /> 📧 Convite por e-mail
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    const origin = typeof window !== "undefined" ? window.location.origin : "https://copa-pulse-watch.lovable.app";
                    const url = `${origin}/criar-bolao`;
                    const msg =
                      `🏆⚽ *BOLÃO AI — CONVITE ESPECIAL* 🇧🇷\n` +
                      `━━━━━━━━━━━━━━━━━━━━\n\n` +
                      `Fala, *craque*! 👋\n\n` +
                      `Você foi convidado pra ser o *organizador oficial* do bolão da sua turma na *Copa 2026*! 🎉⚽\n\n` +
                      `🎁 *É cortesia do Dev* — não é bets 🚫🎰\n` +
                      `🤝 Só diversão entre amigos, família e colegas.\n\n` +
                      `✨ *O QUE VOCÊ GANHA:*\n` +
                      `📱 Palpites 100% pelo WhatsApp\n` +
                      `💰 Pix cai *direto na sua conta*\n` +
                      `🏅 Ranking e ganhadores no automático\n` +
                      `📊 Painel completo pra gerenciar tudo\n` +
                      `🆓 *Grátis até 50 palpites* — todos os recursos liberados\n\n` +
                      `⚡ *COMO COMEÇAR (leva 2 min):*\n` +
                      `1️⃣ Clique no link abaixo\n` +
                      `2️⃣ Crie o seu bolão\n` +
                      `3️⃣ Compartilhe com a galera 🚀\n\n` +
                      `👇 *Crie o seu bolão agora:*\n${url}\n\n` +
                      `━━━━━━━━━━━━━━━━━━━━\n` +
                      `Bora torcer juntos pelo *HEXA*! 🇧🇷🥅🔥`;
                    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
                  }}
                >
                  <MessageCircle className="mr-2 h-4 w-4" /> 💬 Convite por WhatsApp
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* KPIs */}
        <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KpiCard label="No total" value={totals.total} tone="gold" />
          <KpiCard label="Ativos" value={totals.ativos} tone="pitch" />
          <KpiCard label="Suspensos" value={totals.suspensos} tone="samba" />
          <KpiCard label="Nunca logaram" value={totals.semLogin} tone="muted" />
        </div>
      </div>


      {msg && (
        <div
          className={`rounded-lg border p-3 text-sm flex items-start gap-2 ${
            msg.kind === "ok"
              ? "border-pitch/30 bg-pitch/5 text-pitch"
              : "border-destructive/30 bg-destructive/5 text-destructive"
          }`}
        >
          {msg.kind === "ok" ? (
            <CheckCircle2 className="h-4 w-4 mt-0.5" />
          ) : (
            <XCircle className="h-4 w-4 mt-0.5" />
          )}
          <span className="flex-1">{msg.text}</span>
          <button onClick={() => setMsg(null)} className="text-xs opacity-70 hover:opacity-100">
            fechar
          </button>
        </div>
      )}

      {showForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            invite.mutate(form);
          }}
          className="rounded-xl border border-border bg-card p-4 grid gap-3 sm:grid-cols-2"
        >
          <label className="text-xs font-semibold uppercase text-muted-foreground space-y-1 block sm:col-span-2">
            E-mail
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="mt-1 w-full h-10 px-3 rounded-lg border border-border bg-background text-sm"
            />
          </label>
          <label className="text-xs font-semibold uppercase text-muted-foreground space-y-1 block">
            Responsável
            <input
              required
              value={form.nome_responsavel}
              onChange={(e) => setForm({ ...form, nome_responsavel: e.target.value })}
              className="mt-1 w-full h-10 px-3 rounded-lg border border-border bg-background text-sm"
            />
          </label>
          <label className="text-xs font-semibold uppercase text-muted-foreground space-y-1 block">
            Estabelecimento
            <input
              required
              value={form.nome_estabelecimento}
              onChange={(e) => setForm({ ...form, nome_estabelecimento: e.target.value })}
              className="mt-1 w-full h-10 px-3 rounded-lg border border-border bg-background text-sm"
            />
          </label>
          <div className="sm:col-span-2 flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="h-10 px-4 rounded-lg border border-border text-sm font-semibold"
            >
              Cancelar
            </button>
            <button
              disabled={invite.isPending}
              className="h-10 px-4 rounded-lg bg-pitch text-primary-foreground text-sm font-bold inline-flex items-center gap-1"
            >
              <Mail className="h-4 w-4" /> {invite.isPending ? "Enviando…" : "Enviar convite"}
            </button>
          </div>
      </form>
      )}


      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card/60 p-3 backdrop-blur">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gold" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, e-mail, WhatsApp, cidade…"
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-background text-sm focus:border-gold/50 focus:ring-2 focus:ring-gold/20 transition"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="h-10 px-3 rounded-lg border border-border bg-background text-sm focus:border-gold/50"
        >
          <option value="all">Todos status</option>
          <option value="active">Ativos</option>
          <option value="suspended">Suspensos</option>
        </select>
        <select
          value={planoFilter}
          onChange={(e) => setPlanoFilter(e.target.value)}
          className="h-10 px-3 rounded-lg border border-border bg-background text-sm focus:border-gold/50"
        >
          <option value="all">Todos planos</option>
          {planoNames.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-2xl border border-border bg-card/60 divide-y divide-border overflow-hidden backdrop-blur">
        {isLoading && <p className="p-6 text-center text-sm text-muted-foreground">Carregando…</p>}
        {!isLoading && filtered.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">Nenhum organizador encontrado.</p>
        )}
        {filtered.map((g: any) => (
          <div
            key={g.id}
            className="group relative p-4 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 transition-colors hover:bg-gradient-to-r hover:from-pitch/10 hover:via-transparent hover:to-gold/10"
          >
            <span className="absolute left-0 top-0 h-full w-1 bg-gradient-pitch opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setDetailId(g.id)}
                  className="font-semibold truncate hover:underline text-left"
                  title="Ver detalhes"
                >
                  {g.nome_estabelecimento}
                </button>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                    g.status === "active"
                      ? "bg-pitch/15 text-pitch"
                      : "bg-destructive/15 text-destructive"
                  }`}
                >
                  {g.status === "active" ? "ativo" : "suspenso"}
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-muted">
                  {g.plano}
                </span>
                {g.roles?.includes("super_admin") && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-amber-500/15 text-amber-600">
                    super
                  </span>
                )}
                {g.roles?.includes("admin") && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-blue-500/15 text-blue-600">
                    admin
                  </span>
                )}
              </div>
              <div className="mt-1 text-xs text-muted-foreground truncate">
                {g.nome_responsavel} • {g.email} {g.whatsapp ? `• ${g.whatsapp}` : ""}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {g.cidade ? `${g.cidade}/${g.estado ?? ""} • ` : ""}
                {g.boloes_count} bolão(ões) • criado {formatBRDateOnly(g.created_at)}
                {g.last_sign_in_at
                  ? ` • último login ${formatBRShort(g.last_sign_in_at)}`
                  : " • sem login"}
              </div>
            </div>
            <div className="flex flex-col gap-1 self-start items-end">
              <div className="flex gap-1">
                <select
                  value={planoEdit[g.id] ?? ""}
                  onChange={(e) => setPlanoEdit({ ...planoEdit, [g.id]: e.target.value })}
                  className="h-8 px-2 rounded-md border border-border bg-background text-xs"
                  title="Selecionar plano"
                >
                  <option value="">Mudar plano…</option>
                  {planos.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}{" "}
                      {Number(p.preco) > 0 ? `· R$${Number(p.preco).toFixed(0)}` : "· grátis"}
                    </option>
                  ))}
                </select>
                <button
                  disabled={!planoEdit[g.id] || changePlano.isPending}
                  onClick={() => changePlano.mutate({ tenant_id: g.id, plano_id: planoEdit[g.id] })}
                  className="h-8 px-3 rounded-md bg-pitch text-primary-foreground text-xs font-bold inline-flex items-center gap-1 disabled:opacity-50"
                  title="Aplicar plano (mantém dados)"
                >
                  <CreditCard className="h-3.5 w-3.5" /> Aplicar
                </button>
                {(() => {
                  const liberado = (planos as any[]).find((p) => /liberado.*dev/i.test(p.nome));
                  if (!liberado || g.plano === liberado.nome) return null;
                  return (
                    <button
                      disabled={changePlano.isPending}
                      onClick={() => {
                        if (confirm(`Liberar acesso total (palpites ilimitados) para ${g.nome_estabelecimento}? Dados e configurações são preservados.`)) {
                          changePlano.mutate({ tenant_id: g.id, plano_id: liberado.id });
                        }
                      }}
                      className="h-8 px-3 rounded-md bg-gradient-gold text-gold-foreground text-xs font-bold inline-flex items-center gap-1 shadow-gold disabled:opacity-50"
                      title="Liberar acesso total (palpites ilimitados, mantém dados)"
                    >
                      🔓 Liberar
                    </button>
                  );
                })()}
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setDetailId(g.id)}
                  className="h-8 px-3 rounded-md border border-border text-xs font-semibold inline-flex items-center gap-1"
                  title="Ver detalhes"
                >
                  <Eye className="h-3.5 w-3.5" /> Detalhes
                </button>
                <button
                  onClick={() => setConfirmSuspend(g)}
                  className="h-8 px-3 rounded-md border border-border text-xs font-semibold inline-flex items-center gap-1"
                  title={g.status === "active" ? "Suspender acesso" : "Reativar acesso"}
                >
                  {g.status === "active" ? (
                    <Pause className="h-3.5 w-3.5" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                  {g.status === "active" ? "Suspender" : "Reativar"}
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="h-8 w-8 grid place-items-center rounded-md border border-border"
                      title="Mais ações"
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-60">
                    <DropdownMenuItem onClick={() => resetPwd.mutate(g.id)}>
                      <KeyRound className="h-3.5 w-3.5 mr-2" /> Gerar link de redefinição
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => resendInvite.mutate(g.id)}>
                      <Send className="h-3.5 w-3.5 mr-2" /> Reenviar convite
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {g.roles?.includes("super_admin") ? (
                      <DropdownMenuItem
                        onClick={() =>
                          revokeRole.mutate({ tenant_id: g.id, role: "super_admin" })
                        }
                      >
                        <ShieldMinus className="h-3.5 w-3.5 mr-2" /> Remover super admin
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onClick={() =>
                          grantRole.mutate({ tenant_id: g.id, role: "super_admin" })
                        }
                      >
                        <ShieldPlus className="h-3.5 w-3.5 mr-2" /> Promover a super admin
                      </DropdownMenuItem>
                    )}
                    {g.roles?.includes("admin") ? (
                      <DropdownMenuItem
                        onClick={() => revokeRole.mutate({ tenant_id: g.id, role: "admin" })}
                      >
                        <ShieldMinus className="h-3.5 w-3.5 mr-2" /> Remover admin
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onClick={() => grantRole.mutate({ tenant_id: g.id, role: "admin" })}
                      >
                        <ShieldPlus className="h-3.5 w-3.5 mr-2" /> Conceder admin
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setConfirmDelete({ id: g.id, nome: g.nome_estabelecimento })}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir organizador
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

              </div>
            </div>
          </div>
        ))}
      </div>

      <GestorDetailSheet
        tenantId={detailId}
        onClose={() => setDetailId(null)}
        getDetailFn={useServerFn(getGestorDetail)}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir organizador?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove o tenant <strong>{confirmDelete?.nome}</strong>, todos os bolões,
              palpites, torcedores e o usuário de autenticação. Não pode ser desfeita. Para apenas
              bloquear o acesso, prefira <strong>Suspender</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDelete && remove.mutate(confirmDelete.id)}
            >
              Excluir definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmSuspend} onOpenChange={(o) => !o && setConfirmSuspend(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmSuspend?.status === "active" ? "Suspender acesso?" : "Reativar acesso?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmSuspend?.status === "active"
                ? "O organizador não conseguirá acessar o painel enquanto estiver suspenso. Os dados são preservados."
                : "O organizador voltará a conseguir acessar o painel normalmente."}
              <br />
              <strong>{confirmSuspend?.nome_estabelecimento}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmSuspend) toggleStatus.mutate(confirmSuspend);
                setConfirmSuspend(null);
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!recoveryLink} onOpenChange={(o) => !o && setRecoveryLink(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Link de redefinição de senha</AlertDialogTitle>
            <AlertDialogDescription>
              Envie este link para <strong>{recoveryLink?.email}</strong>. Ele expira em 1 hora e é
              de uso único.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {recoveryLink?.link ? (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-2">
              <code className="text-[11px] break-all flex-1">{recoveryLink.link}</code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(recoveryLink.link ?? "");
                  notify("Link copiado.");
                }}
                className="h-8 px-2 rounded-md border border-border text-xs font-semibold inline-flex items-center gap-1"
              >
                <Copy className="h-3.5 w-3.5" /> Copiar
              </button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              O e-mail de recuperação foi disparado pelo provedor.
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setRecoveryLink(null)}>Fechar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


function GestorDetailSheet({
  tenantId,
  onClose,
  getDetailFn,
}: {
  tenantId: string | null;
  onClose: () => void;
  getDetailFn: any;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["gestor-detail", tenantId],
    queryFn: () => getDetailFn({ data: { tenant_id: tenantId } }),
    enabled: !!tenantId,
  });

  return (
    <Sheet open={!!tenantId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{data?.tenant?.nome_estabelecimento ?? "Detalhes"}</SheetTitle>
          <SheetDescription>
            {data?.tenant?.nome_responsavel} · {data?.tenant?.email}
          </SheetDescription>
        </SheetHeader>

        {isLoading && <p className="mt-6 text-sm text-muted-foreground">Carregando…</p>}
        {data && (
          <div className="mt-6 space-y-6">
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="Bolões" value={data.boloes.length} />
              <Stat label="Torcedores" value={data.torcedores_count} />
              <Stat label="Palpites" value={data.palpites_count} />
            </div>

            <div className="flex gap-2 text-xs">
              <span
                className={`px-2 py-1 rounded ${data.pix_configurado ? "bg-pitch/15 text-pitch" : "bg-muted text-muted-foreground"}`}
              >
                PIX {data.pix_configurado ? "configurado" : "pendente"}
              </span>
              <span
                className={`px-2 py-1 rounded ${data.whatsapp_configurado ? "bg-pitch/15 text-pitch" : "bg-muted text-muted-foreground"}`}
              >
                WhatsApp {data.whatsapp_configurado ? "configurado" : "pendente"}
              </span>
            </div>

            <Section title="Bolões">
              {data.boloes.length === 0 && <Empty>Sem bolões criados.</Empty>}
              {data.boloes.map((b: any) => (
                <div key={b.id} className="flex items-center justify-between py-1.5 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{b.nome}</div>
                    <div className="text-[11px] text-muted-foreground">
                      /{b.slug} · {b.status}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    R${Number(b.valor_palpite ?? 0).toFixed(0)}
                  </div>
                </div>
              ))}
            </Section>

            <Section title="Histórico de assinaturas">
              {data.assinaturas.length === 0 && <Empty>Sem assinaturas.</Empty>}
              {data.assinaturas.map((a: any) => (
                <div key={a.id} className="flex items-center justify-between py-1.5 text-sm">
                  <div>
                    <div className="font-medium">{a.planos?.nome ?? "—"}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {formatBRDateOnly(a.data_inicio)}
                      {a.data_fim ? `→ ${formatBRDateOnly(a.data_fim)}` : "→ atual"} ·{" "}
                      {a.gateway_pagamento ?? "—"}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                      a.status === "ativa"
                        ? "bg-pitch/15 text-pitch"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {a.status}
                  </span>
                </div>
              ))}
            </Section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-xl font-black">{value}</div>
      <div className="text-[10px] uppercase text-muted-foreground font-semibold">{label}</div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "gold" | "pitch" | "samba" | "muted";
}) {
  const toneMap: Record<string, string> = {
    gold: "from-gold/25 to-transparent border-gold/40 text-gold",
    pitch: "from-pitch/25 to-transparent border-pitch/40 text-pitch",
    samba: "from-destructive/25 to-transparent border-destructive/40 text-destructive",
    muted: "from-muted/40 to-transparent border-border text-muted-foreground",
  };
  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${toneMap[tone]} bg-card/60 p-3 backdrop-blur transition-transform hover:-translate-y-0.5`}
    >
      <div className="text-2xl font-black text-foreground">{value}</div>
      <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider">{label}</div>
    </div>
  );
}


function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-bold uppercase text-muted-foreground mb-2">{title}</h3>
      <div className="rounded-lg border border-border bg-card divide-y divide-border px-3">
        {children}
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-2 text-xs text-muted-foreground">{children}</p>;
}
