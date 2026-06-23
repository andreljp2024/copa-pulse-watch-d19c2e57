import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Save } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/pix")({
  component: PixConfigPage,
});

function PixConfigPage() {
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [form, setForm] = useState({
    nome_recebedor: "",
    tipo_chave_pix: "cpf",
    chave_pix: "",
    banco: "",
    cidade: "",
    valor_padrao_palpite: 10,
    instrucoes_pagamento: "",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data: t } = await supabase.from("tenants").select("id").eq("owner_user_id", u.user!.id).single();
      setTenantId(t.id);
      const { data: pix } = await supabase.from("tenant_pix_config").select("*").eq("tenant_id", t.id).maybeSingle();
      if (pix) setForm({
        nome_recebedor: pix.nome_recebedor,
        tipo_chave_pix: pix.tipo_chave_pix,
        chave_pix: pix.chave_pix,
        banco: pix.banco ?? "",
        cidade: pix.cidade ?? "",
        valor_padrao_palpite: Number(pix.valor_padrao_palpite),
        instrucoes_pagamento: pix.instrucoes_pagamento ?? "",
      });
    })();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!tenantId) return;
    setSaving(true); setMsg(null);
    const { error } = await supabase.from("tenant_pix_config").upsert({ tenant_id: tenantId, ...form }, { onConflict: "tenant_id" });
    setSaving(false);
    setMsg(error ? `Erro: ${error.message}` : "Salvo!");
  }

  return (
    <form onSubmit={save} className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-black">Configuração do Pix</h1>
      <p className="text-sm text-muted-foreground">Esses dados são usados automaticamente nas mensagens de WhatsApp dos torcedores.</p>
      <Field label="Nome do recebedor"><input required value={form.nome_recebedor} onChange={(e) => setForm({ ...form, nome_recebedor: e.target.value })} className={inputCss} /></Field>
      <Field label="Tipo de chave">
        <select value={form.tipo_chave_pix} onChange={(e) => setForm({ ...form, tipo_chave_pix: e.target.value })} className={inputCss}>
          <option value="cpf">CPF</option><option value="cnpj">CNPJ</option><option value="email">E-mail</option><option value="telefone">Telefone</option><option value="aleatoria">Aleatória</option>
        </select>
      </Field>
      <Field label="Chave Pix"><input required value={form.chave_pix} onChange={(e) => setForm({ ...form, chave_pix: e.target.value })} className={inputCss} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Banco"><input value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} className={inputCss} /></Field>
        <Field label="Cidade"><input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} className={inputCss} /></Field>
      </div>
      <Field label="Valor padrão do palpite (R$)"><input type="number" value={form.valor_padrao_palpite} onChange={(e) => setForm({ ...form, valor_padrao_palpite: Number(e.target.value) })} className={inputCss} /></Field>
      <Field label="Instruções de pagamento"><textarea rows={3} value={form.instrucoes_pagamento} onChange={(e) => setForm({ ...form, instrucoes_pagamento: e.target.value })} className={inputCss} /></Field>
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
