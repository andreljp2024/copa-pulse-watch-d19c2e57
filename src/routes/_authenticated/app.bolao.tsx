import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { slugify } from "@/lib/saas";
import { Loader2, Save } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/bolao")({
  component: BolaoConfigPage,
});

function BolaoConfigPage() {
  const [bolaoId, setBolaoId] = useState<string | null>(null);
  const [form, setForm] = useState({
    nome: "", slug: "", descricao: "", regras: "", valor_palpite: 10,
    permitir_ranking_publico: true, permitir_ganhadores_publico: true,
    data_limite_palpite: "",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data: t } = await supabase.from("tenants").select("id").eq("owner_user_id", u.user!.id).single(); if (!t) return;
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

  return (
    <form onSubmit={save} className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-black">Configuração do bolão</h1>
      <Field label="Nome"><input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className={inputCss} /></Field>
      <Field label="Slug (link público /bolao/...)"><input required value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} className={inputCss} /></Field>
      <Field label="Descrição"><textarea rows={2} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className={inputCss} /></Field>
      <Field label="Regras"><textarea rows={4} value={form.regras} onChange={(e) => setForm({ ...form, regras: e.target.value })} className={inputCss} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Valor do palpite (R$)"><input type="number" value={form.valor_palpite} onChange={(e) => setForm({ ...form, valor_palpite: Number(e.target.value) })} className={inputCss} /></Field>
        <Field label="Data limite para palpite"><input type="datetime-local" value={form.data_limite_palpite} onChange={(e) => setForm({ ...form, data_limite_palpite: e.target.value })} className={inputCss} /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.permitir_ranking_publico} onChange={(e) => setForm({ ...form, permitir_ranking_publico: e.target.checked })} /> Permitir ranking público</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.permitir_ganhadores_publico} onChange={(e) => setForm({ ...form, permitir_ganhadores_publico: e.target.checked })} /> Permitir lista pública de ganhadores</label>
      <button disabled={saving} className="inline-flex h-11 items-center gap-2 rounded-xl bg-pitch px-5 font-semibold text-primary-foreground disabled:opacity-60">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
      </button>
      {msg && <p className="text-sm">{msg}</p>}
    </form>
  );
}

const inputCss = "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-pitch/40";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-sm font-medium">{label}</span>{children}</label>;
}
