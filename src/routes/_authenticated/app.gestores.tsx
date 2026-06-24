import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { format } from "date-fns";
import { Shield, UserPlus, Pause, Play, Trash2, Mail, CreditCard } from "lucide-react";
import {
  isSuperAdmin,
  listGestores,
  inviteGestor,
  updateGestorStatus,
  deleteGestor,
  listPlanosAdmin,
  changeGestorPlano,
} from "@/lib/gestores.functions";

export const Route = createFileRoute("/_authenticated/app/gestores")({
  head: () => ({ meta: [{ title: "Gestores — Bolão AI" }] }),
  component: GestoresPage,
});

function GestoresPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const checkFn = useServerFn(isSuperAdmin);
  const listFn = useServerFn(listGestores);
  const inviteFn = useServerFn(inviteGestor);
  const statusFn = useServerFn(updateGestorStatus);
  const deleteFn = useServerFn(deleteGestor);

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

  return <GestoresInner listFn={listFn} inviteFn={inviteFn} statusFn={statusFn} deleteFn={deleteFn} qc={qc} />;
}

function GestoresInner({ listFn, inviteFn, statusFn, deleteFn, qc }: any) {
  const planosFn = useServerFn(listPlanosAdmin);
  const changePlanoFn = useServerFn(changeGestorPlano);
  const { data: gestores = [], isLoading } = useQuery({ queryKey: ["gestores"], queryFn: () => listFn() });
  const { data: planos = [] } = useQuery({ queryKey: ["planos-admin"], queryFn: () => planosFn() });
  const [msg, setMsg] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: "", nome_responsavel: "", nome_estabelecimento: "" });
  const [planoEdit, setPlanoEdit] = useState<Record<string, string>>({});

  const invalidate = () => qc.invalidateQueries({ queryKey: ["gestores"] });

  const changePlano = useMutation({
    mutationFn: (d: { tenant_id: string; plano_id: string }) => changePlanoFn({ data: d }),
    onSuccess: (r: any) => { setMsg(`Plano alterado para ${r.plano}.`); invalidate(); },
    onError: (e: any) => setMsg(e?.message ?? "Falha ao alterar plano."),
  });

  const invite = useMutation({
    mutationFn: (d: typeof form) => inviteFn({ data: d }),
    onSuccess: () => {
      setMsg("Convite enviado com sucesso.");
      setForm({ email: "", nome_responsavel: "", nome_estabelecimento: "" });
      setShowForm(false);
      invalidate();
    },
    onError: (e: any) => setMsg(e?.message ?? "Falha ao convidar."),
  });

  const toggleStatus = useMutation({
    mutationFn: (g: any) =>
      statusFn({ data: { tenant_id: g.id, status: g.status === "active" ? "suspended" : "active" } }),
    onSuccess: invalidate,
    onError: (e: any) => setMsg(e?.message ?? "Falha ao atualizar."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { tenant_id: id, delete_auth_user: true } }),
    onSuccess: () => { setMsg("Gestor removido."); invalidate(); },
    onError: (e: any) => setMsg(e?.message ?? "Falha ao remover."),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black">Gestores de bolão</h1>
          <p className="text-sm text-muted-foreground">
            {gestores.length} gestor{gestores.length === 1 ? "" : "es"} cadastrado{gestores.length === 1 ? "" : "s"}.
          </p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-pitch px-4 text-sm font-bold text-primary-foreground"
        >
          <UserPlus className="h-4 w-4" /> Novo gestor
        </button>
      </div>

      {msg && <div className="rounded-lg border border-border bg-card p-3 text-sm">{msg}</div>}

      {showForm && (
        <form
          onSubmit={(e) => { e.preventDefault(); invite.mutate(form); }}
          className="rounded-xl border border-border bg-card p-4 grid gap-3 sm:grid-cols-2"
        >
          <label className="text-xs font-semibold uppercase text-muted-foreground space-y-1 block sm:col-span-2">
            E-mail
            <input
              type="email" required value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="mt-1 w-full h-10 px-3 rounded-lg border border-border bg-background text-sm"
            />
          </label>
          <label className="text-xs font-semibold uppercase text-muted-foreground space-y-1 block">
            Responsável
            <input
              required value={form.nome_responsavel}
              onChange={(e) => setForm({ ...form, nome_responsavel: e.target.value })}
              className="mt-1 w-full h-10 px-3 rounded-lg border border-border bg-background text-sm"
            />
          </label>
          <label className="text-xs font-semibold uppercase text-muted-foreground space-y-1 block">
            Estabelecimento
            <input
              required value={form.nome_estabelecimento}
              onChange={(e) => setForm({ ...form, nome_estabelecimento: e.target.value })}
              className="mt-1 w-full h-10 px-3 rounded-lg border border-border bg-background text-sm"
            />
          </label>
          <div className="sm:col-span-2 flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="h-10 px-4 rounded-lg border border-border text-sm font-semibold">
              Cancelar
            </button>
            <button disabled={invite.isPending} className="h-10 px-4 rounded-lg bg-pitch text-primary-foreground text-sm font-bold inline-flex items-center gap-1">
              <Mail className="h-4 w-4" /> {invite.isPending ? "Enviando…" : "Enviar convite"}
            </button>
          </div>
        </form>
      )}

      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {isLoading && <p className="p-6 text-center text-sm text-muted-foreground">Carregando…</p>}
        {!isLoading && gestores.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">Nenhum gestor cadastrado.</p>
        )}
        {gestores.map((g: any) => (
          <div key={g.id} className="p-4 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold truncate">{g.nome_estabelecimento}</span>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${g.status === "active" ? "bg-pitch/15 text-pitch" : "bg-destructive/15 text-destructive"}`}>
                  {g.status}
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-muted">{g.plano}</span>
                {g.roles?.includes("super_admin") && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-amber-500/15 text-amber-600">super</span>
                )}
                {g.roles?.includes("admin") && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-blue-500/15 text-blue-600">admin</span>
                )}
              </div>
              <div className="mt-1 text-xs text-muted-foreground truncate">
                {g.nome_responsavel} • {g.email} {g.whatsapp ? `• ${g.whatsapp}` : ""}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {g.cidade ? `${g.cidade}/${g.estado ?? ""} • ` : ""}{g.boloes_count} bolão(ões) • criado {format(new Date(g.created_at), "dd/MM/yy")}
                {g.last_sign_in_at ? ` • último login ${format(new Date(g.last_sign_in_at), "dd/MM HH:mm")}` : " • sem login"}
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
                      {p.nome} {Number(p.preco) > 0 ? `· R$${Number(p.preco).toFixed(0)}` : "· grátis"}
                    </option>
                  ))}
                </select>
                <button
                  disabled={!planoEdit[g.id] || changePlano.isPending}
                  onClick={() => changePlano.mutate({ tenant_id: g.id, plano_id: planoEdit[g.id] })}
                  className="h-8 px-3 rounded-md bg-pitch text-primary-foreground text-xs font-bold inline-flex items-center gap-1 disabled:opacity-50"
                  title="Aplicar plano"
                >
                  <CreditCard className="h-3.5 w-3.5" /> Aplicar
                </button>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => toggleStatus.mutate(g)}
                  className="h-8 px-3 rounded-md border border-border text-xs font-semibold inline-flex items-center gap-1"
                  title={g.status === "active" ? "Suspender" : "Reativar"}
                >
                  {g.status === "active" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  {g.status === "active" ? "Suspender" : "Reativar"}
                </button>
                <button
                  onClick={() => { if (confirm(`Excluir gestor "${g.nome_estabelecimento}"? Isso remove o tenant e o usuário de autenticação.`)) remove.mutate(g.id); }}
                  className="h-8 w-8 grid place-items-center rounded-md border border-border text-destructive"
                  title="Excluir"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
