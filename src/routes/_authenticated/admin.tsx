import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { isAdmin, syncFromExternalApi, listSyncLogs, upsertMatch, deleteMatch, upsertTeam } from "@/lib/admin.functions";
import { listMatches, listTeams, listGroups } from "@/lib/copa.functions";
import { format } from "date-fns";
import { RefreshCw, LogOut, Shield, Trash2, Plus, Save, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — Bolão AI" }] }),
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const adminCheck = useServerFn(isAdmin);
  
  const sync = useServerFn(syncFromExternalApi);
  const logsFn = useServerFn(listSyncLogs);

  const { data: admin, refetch: refetchAdmin } = useQuery({ queryKey: ["isAdmin"], queryFn: () => adminCheck() });
  const [tab, setTab] = useState<"matches" | "teams" | "logs">("matches");
  const [msg, setMsg] = useState<string | null>(null);

  const syncMut = useMutation({
    mutationFn: () => sync(),
    onSuccess: (r) => { setMsg(r.message); qc.invalidateQueries({ queryKey: ["syncLogs"] }); },
    onError: (e: any) => setMsg(e.message),
  });



  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (!admin) return <AppShell><div className="mx-auto max-w-7xl px-4 py-10">Carregando…</div></AppShell>;

  if (!admin.isAdmin) {
    return (
      <AppShell>
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <Shield className="h-10 w-10 mx-auto text-pitch" />
          <h1 className="mt-4 text-2xl font-black">Acesso restrito</h1>
          <p className="mt-2 text-sm text-muted-foreground">Você precisa de papel de administrador. Peça a um administrador existente para conceder acesso.</p>
          {msg && <p className="mt-3 text-sm">{msg}</p>}
          <button onClick={signOut} className="mt-6 text-xs text-muted-foreground underline">Sair</button>
        </div>
      </AppShell>
    );
  }


  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black">Painel Administrativo</h1>
            <p className="text-sm text-muted-foreground">Gerencie partidas, seleções e sincronização.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => syncMut.mutate()} disabled={syncMut.isPending} className="inline-flex h-10 items-center gap-2 rounded-lg bg-pitch px-4 text-sm font-bold text-primary-foreground disabled:opacity-60">
              <RefreshCw className={`h-4 w-4 ${syncMut.isPending ? "animate-spin" : ""}`} /> Sincronizar API
            </button>
            <button onClick={signOut} className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold">
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </div>
        </div>
        {msg && <div className="mt-4 rounded-lg border border-border bg-card p-3 text-sm">{msg}</div>}

        <div className="mt-6 flex gap-1 rounded-lg bg-muted p-1 w-fit">
          {[["matches","Partidas"],["teams","Seleções"],["logs","Logs"]].map(([k,l]) => (
            <button key={k} onClick={() => setTab(k as any)} className={`px-4 py-2 rounded-md text-sm font-semibold ${tab === k ? "bg-card shadow" : "text-muted-foreground"}`}>{l}</button>
          ))}
        </div>

        <div className="mt-6">
          {tab === "matches" && <MatchesAdmin />}
          {tab === "teams" && <TeamsAdmin />}
          {tab === "logs" && <LogsAdmin fn={logsFn} />}
        </div>
      </div>
    </AppShell>
  );
}

function MatchesAdmin() {
  const qc = useQueryClient();
  const list = useServerFn(listMatches);
  const teamsFn = useServerFn(listTeams);
  const upsert = useServerFn(upsertMatch);
  const del = useServerFn(deleteMatch);
  const { data: matches = [] } = useQuery({ queryKey: ["matches"], queryFn: () => list() });
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => teamsFn() });
  const [editing, setEditing] = useState<any | null>(null);
  const invalidate = () => qc.invalidateQueries();

  const save = useMutation({ mutationFn: (d: any) => upsert({ data: d }), onSuccess: () => { setEditing(null); invalidate(); } });
  const remove = useMutation({ mutationFn: (id: string) => del({ data: { id } }), onSuccess: invalidate });

  return (
    <div className="space-y-4">
      <button onClick={() => setEditing({ phase: "group", status: "scheduled", home_score: 0, away_score: 0, kickoff_at: new Date().toISOString().slice(0,16) })} className="inline-flex h-10 items-center gap-2 rounded-lg bg-pitch px-4 text-sm font-bold text-primary-foreground">
        <Plus className="h-4 w-4" /> Nova partida
      </button>
      {editing && <MatchForm initial={editing} teams={teams} onCancel={() => setEditing(null)} onSave={(d: any) => save.mutate(d)} saving={save.isPending} />}
      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {matches.map((m: any) => (
          <div key={m.id} className="p-3 grid grid-cols-[1fr_auto] items-center gap-3">
            <div className="min-w-0">
              <div className="font-semibold truncate">{m.home?.name} {m.home_score}–{m.away_score} {m.away?.name}</div>
              <div className="text-xs text-muted-foreground">{format(new Date(m.kickoff_at), "dd/MM HH:mm")} • {m.status} • {m.phase}</div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => setEditing({ id: m.id, home_team_id: m.home?.id, away_team_id: m.away?.id, group_id: m.group_id, phase: m.phase, stadium_id: m.stadium_id, kickoff_at: m.kickoff_at.slice(0,16), status: m.status, home_score: m.home_score, away_score: m.away_score })} className="h-8 px-3 rounded-md border border-border text-xs font-semibold">Editar</button>
              <button onClick={() => { if (confirm("Excluir?")) remove.mutate(m.id); }} className="h-8 w-8 grid place-items-center rounded-md border border-border text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MatchForm({ initial, teams, onCancel, onSave, saving }: any) {
  const [f, setF] = useState(initial);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ ...f, kickoff_at: new Date(f.kickoff_at).toISOString(), home_score: Number(f.home_score), away_score: Number(f.away_score) }); }} className="rounded-xl border border-border bg-card p-4 grid gap-3 sm:grid-cols-2">
      <Sel label="Mandante" value={f.home_team_id} onChange={(v: string) => setF({ ...f, home_team_id: v })}>
        <option value="">—</option>{teams.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </Sel>
      <Sel label="Visitante" value={f.away_team_id} onChange={(v: string) => setF({ ...f, away_team_id: v })}>
        <option value="">—</option>{teams.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </Sel>
      <Sel label="Fase" value={f.phase} onChange={(v: string) => setF({ ...f, phase: v })}>
        {["group","round_of_16","quarter","semi","third_place","final"].map(p => <option key={p} value={p}>{p}</option>)}
      </Sel>
      <Sel label="Status" value={f.status} onChange={(v: string) => setF({ ...f, status: v })}>
        {["scheduled","live","finished","postponed","cancelled"].map(s => <option key={s} value={s}>{s}</option>)}
      </Sel>
      <Field label="Início"><input required type="datetime-local" value={f.kickoff_at} onChange={(e) => setF({ ...f, kickoff_at: e.target.value })} className="input" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Placar M"><input type="number" min={0} value={f.home_score} onChange={(e) => setF({ ...f, home_score: e.target.value })} className="input" /></Field>
        <Field label="Placar V"><input type="number" min={0} value={f.away_score} onChange={(e) => setF({ ...f, away_score: e.target.value })} className="input" /></Field>
      </div>
      <div className="sm:col-span-2 flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="h-10 px-4 rounded-lg border border-border text-sm font-semibold inline-flex items-center gap-1"><X className="h-4 w-4" /> Cancelar</button>
        <button disabled={saving} className="h-10 px-4 rounded-lg bg-pitch text-primary-foreground text-sm font-bold inline-flex items-center gap-1"><Save className="h-4 w-4" /> Salvar</button>
      </div>
    </form>
  );
}

function TeamsAdmin() {
  const qc = useQueryClient();
  const list = useServerFn(listTeams);
  const groupsFn = useServerFn(listGroups);
  const upsert = useServerFn(upsertTeam);
  const { data: teams = [] } = useQuery({ queryKey: ["teams"], queryFn: () => list() });
  const { data: g } = useQuery({ queryKey: ["groups"], queryFn: () => groupsFn() });
  const [editing, setEditing] = useState<any | null>(null);
  const save = useMutation({ mutationFn: (d: any) => upsert({ data: d }), onSuccess: () => { setEditing(null); qc.invalidateQueries(); } });

  return (
    <div className="space-y-4">
      <button onClick={() => setEditing({ name: "", code: "", confederation: "", coach_name: "", fifa_rank: null, flag_url: "" })} className="inline-flex h-10 items-center gap-2 rounded-lg bg-pitch px-4 text-sm font-bold text-primary-foreground"><Plus className="h-4 w-4" /> Nova seleção</button>
      {editing && (
        <form onSubmit={(e) => { e.preventDefault(); save.mutate({ ...editing, fifa_rank: editing.fifa_rank ? Number(editing.fifa_rank) : null, flag_url: editing.flag_url || null }); }} className="rounded-xl border border-border bg-card p-4 grid gap-3 sm:grid-cols-2">
          <Field label="Nome"><input required value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="input" /></Field>
          <Field label="Código (3 letras)"><input required maxLength={4} value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })} className="input" /></Field>
          <Field label="Confederação"><input value={editing.confederation ?? ""} onChange={(e) => setEditing({ ...editing, confederation: e.target.value })} className="input" /></Field>
          <Field label="Técnico"><input value={editing.coach_name ?? ""} onChange={(e) => setEditing({ ...editing, coach_name: e.target.value })} className="input" /></Field>
          <Field label="Ranking FIFA"><input type="number" value={editing.fifa_rank ?? ""} onChange={(e) => setEditing({ ...editing, fifa_rank: e.target.value })} className="input" /></Field>
          <Sel label="Grupo" value={editing.group_id ?? ""} onChange={(v: string) => setEditing({ ...editing, group_id: v || null })}>
            <option value="">Sem grupo</option>{(g?.groups ?? []).map((gr: any) => <option key={gr.id} value={gr.id}>Grupo {gr.name}</option>)}
          </Sel>
          <Field label="URL da bandeira"><input value={editing.flag_url ?? ""} onChange={(e) => setEditing({ ...editing, flag_url: e.target.value })} className="input" /></Field>
          <div className="sm:col-span-2 flex gap-2 justify-end">
            <button type="button" onClick={() => setEditing(null)} className="h-10 px-4 rounded-lg border border-border text-sm font-semibold">Cancelar</button>
            <button disabled={save.isPending} className="h-10 px-4 rounded-lg bg-pitch text-primary-foreground text-sm font-bold">Salvar</button>
          </div>
        </form>
      )}
      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {teams.map((t: any) => (
          <div key={t.id} className="p-3 flex items-center gap-3">
            {t.flag_url && <img src={t.flag_url} alt="" className="h-6 w-9 object-cover rounded-sm" />}
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{t.name} <span className="text-xs text-muted-foreground">({t.code})</span></div>
              <div className="text-xs text-muted-foreground">{t.group?.name ? `Grupo ${t.group.name} • ` : ""}{t.coach_name ?? "—"}</div>
            </div>
            <button onClick={() => setEditing(t)} className="h-8 px-3 rounded-md border border-border text-xs font-semibold">Editar</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function LogsAdmin({ fn }: { fn: any }) {
  const { data = [] } = useQuery({ queryKey: ["syncLogs"], queryFn: () => fn() });
  return (
    <div className="rounded-xl border border-border bg-card divide-y divide-border">
      {data.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Sem registros de sincronização.</p>}
      {data.map((l: any) => (
        <div key={l.id} className="p-3 grid grid-cols-[auto_1fr_auto] items-center gap-3 text-sm">
          <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${l.status === "success" ? "bg-pitch/15 text-pitch" : l.status === "skipped" ? "bg-muted" : "bg-destructive/15 text-destructive"}`}>{l.status}</span>
          <div className="min-w-0"><div className="font-semibold truncate">{l.action}</div><div className="text-xs text-muted-foreground truncate">{l.message}</div></div>
          <span className="text-xs text-muted-foreground">{format(new Date(l.created_at), "dd/MM HH:mm")}</span>
        </div>
      ))}
    </div>
  );
}

function Field({ label, children }: any) {
  return <label className="text-xs font-semibold uppercase text-muted-foreground space-y-1 block">{label}<div className="mt-1">{children}</div></label>;
}
function Sel({ label, value, onChange, children }: any) {
  return <Field label={label}><select value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="input">{children}</select></Field>;
}
