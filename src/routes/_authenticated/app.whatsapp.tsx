import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_TEMPLATES } from "@/lib/saas";
import { Loader2, Save } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/whatsapp")({
  component: WhatsAppConfigPage,
});

function WhatsAppConfigPage() {
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [form, setForm] = useState({
    numero_whatsapp: "",
    mensagem_novo_palpite: DEFAULT_TEMPLATES.novo_palpite,
    mensagem_confirmacao_pagamento: DEFAULT_TEMPLATES.confirmacao_pagamento,
    mensagem_ganhador: DEFAULT_TEMPLATES.ganhador,
    mensagem_lembrete_pagamento: DEFAULT_TEMPLATES.lembrete_pagamento,
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data: t } = await supabase.from("tenants").select("id").eq("owner_user_id", u.user!.id).single();
      setTenantId(t.id);
      const { data: wa } = await supabase.from("tenant_whatsapp_config").select("*").eq("tenant_id", t.id).maybeSingle();
      if (wa) setForm({
        numero_whatsapp: wa.numero_whatsapp,
        mensagem_novo_palpite: wa.mensagem_novo_palpite ?? DEFAULT_TEMPLATES.novo_palpite,
        mensagem_confirmacao_pagamento: wa.mensagem_confirmacao_pagamento ?? DEFAULT_TEMPLATES.confirmacao_pagamento,
        mensagem_ganhador: wa.mensagem_ganhador ?? DEFAULT_TEMPLATES.ganhador,
        mensagem_lembrete_pagamento: wa.mensagem_lembrete_pagamento ?? DEFAULT_TEMPLATES.lembrete_pagamento,
      });
    })();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!tenantId) return;
    setSaving(true); setMsg(null);
    const { error } = await supabase.from("tenant_whatsapp_config").upsert({ tenant_id: tenantId, ...form }, { onConflict: "tenant_id" });
    setSaving(false);
    setMsg(error ? `Erro: ${error.message}` : "Salvo!");
  }

  return (
    <form onSubmit={save} className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-black">Configuração do WhatsApp</h1>
      <p className="text-sm text-muted-foreground">Variáveis disponíveis: <code>{"{{nome_torcedor}} {{nome_bolao}} {{selecao_a}} {{selecao_b}} {{palpite_a}} {{palpite_b}} {{valor_palpite}} {{nome_recebedor}} {{chave_pix}} {{banco}}"}</code></p>
      <Field label="Número de WhatsApp (com DDI/DDD)"><input required value={form.numero_whatsapp} onChange={(e) => setForm({ ...form, numero_whatsapp: e.target.value })} className={inputCss} placeholder="5511999999999" /></Field>
      <Field label="Novo palpite"><textarea rows={6} value={form.mensagem_novo_palpite} onChange={(e) => setForm({ ...form, mensagem_novo_palpite: e.target.value })} className={inputCss} /></Field>
      <Field label="Confirmação de pagamento"><textarea rows={4} value={form.mensagem_confirmacao_pagamento} onChange={(e) => setForm({ ...form, mensagem_confirmacao_pagamento: e.target.value })} className={inputCss} /></Field>
      <Field label="Ganhador"><textarea rows={4} value={form.mensagem_ganhador} onChange={(e) => setForm({ ...form, mensagem_ganhador: e.target.value })} className={inputCss} /></Field>
      <Field label="Lembrete de pagamento"><textarea rows={3} value={form.mensagem_lembrete_pagamento} onChange={(e) => setForm({ ...form, mensagem_lembrete_pagamento: e.target.value })} className={inputCss} /></Field>
      <button disabled={saving} className="inline-flex h-11 items-center gap-2 rounded-xl bg-pitch px-5 font-semibold text-primary-foreground disabled:opacity-60">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
      </button>
      {msg && <p className="text-sm">{msg}</p>}
    </form>
  );
}

const inputCss = "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-pitch/40 font-mono";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-sm font-medium">{label}</span>{children}</label>;
}
