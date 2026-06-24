import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_TEMPLATES } from "@/lib/saas";
import { Loader2, Save, Link2, Plug, MessageCircle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";


export const Route = createFileRoute("/_authenticated/app/whatsapp")({
  component: WhatsAppConfigPage,
});

type Modo = "link" | "evolution_api";

function WhatsAppConfigPage() {
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [form, setForm] = useState({
    numero_whatsapp: "",
    mensagem_novo_palpite: DEFAULT_TEMPLATES.novo_palpite,
    mensagem_confirmacao_pagamento: DEFAULT_TEMPLATES.confirmacao_pagamento,
    mensagem_ganhador: DEFAULT_TEMPLATES.ganhador,
    mensagem_lembrete_pagamento: DEFAULT_TEMPLATES.lembrete_pagamento,
    integracao_modo: "link" as Modo,
    evolution_base_url: "",
    evolution_api_key: "",
    evolution_instance: "",
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data: t } = await supabase.from("tenants").select("id").eq("owner_user_id", u.user!.id).single();
      if (!t) return;
      setTenantId(t.id);
      const { data: wa } = await supabase.from("tenant_whatsapp_config").select("*").eq("tenant_id", t.id).maybeSingle();
      if (wa) {
        const w = wa as unknown as Record<string, string | null>;
        setForm({
          numero_whatsapp: w.numero_whatsapp ?? "",
          mensagem_novo_palpite: w.mensagem_novo_palpite ?? DEFAULT_TEMPLATES.novo_palpite,
          mensagem_confirmacao_pagamento: w.mensagem_confirmacao_pagamento ?? DEFAULT_TEMPLATES.confirmacao_pagamento,
          mensagem_ganhador: w.mensagem_ganhador ?? DEFAULT_TEMPLATES.ganhador,
          mensagem_lembrete_pagamento: w.mensagem_lembrete_pagamento ?? DEFAULT_TEMPLATES.lembrete_pagamento,
          integracao_modo: ((w.integracao_modo as Modo) ?? "link"),
          evolution_base_url: w.evolution_base_url ?? "",
          evolution_api_key: w.evolution_api_key ?? "",
          evolution_instance: w.evolution_instance ?? "",
        });
      }
    })();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!tenantId) return;
    setSaving(true);
    setMsg(null);
    const payload = { tenant_id: tenantId, ...form };
    const { error } = await supabase.from("tenant_whatsapp_config").upsert(payload as never, { onConflict: "tenant_id" });
    setSaving(false);
    setMsg(error ? `Erro: ${error.message}` : "Salvo!");
  }

  async function testEvolution() {
    setTesting(true);
    setMsg(null);
    try {
      const url = form.evolution_base_url.replace(/\/$/, "");
      const r = await fetch(`${url}/instance/connectionState/${encodeURIComponent(form.evolution_instance)}`, {
        headers: { apikey: form.evolution_api_key },
      });
      const j = await r.json().catch(() => ({}));
      setMsg(r.ok ? `Conexão OK: ${JSON.stringify(j).slice(0, 160)}` : `Falhou (${r.status}): ${JSON.stringify(j).slice(0, 160)}`);
    } catch (err) {
      setMsg(`Erro: ${(err as Error).message}`);
    } finally {
      setTesting(false);
    }
  }

  const isEvo = form.integracao_modo === "evolution_api";

  return (
    <form onSubmit={save} className="max-w-2xl space-y-4">
      <PageHeader
        title="Configuração do WhatsApp"
        subtitle="Defina como suas mensagens são enviadas aos torcedores."
        icon={<MessageCircle className="h-5 w-5" />}
      />



      <div className="rounded-xl border border-border p-4 space-y-3">
        <span className="text-sm font-semibold">Modo de integração</span>
        <div className="grid grid-cols-2 gap-2">
          <ModoBtn active={!isEvo} onClick={() => setForm({ ...form, integracao_modo: "link" })} icon={<Link2 className="h-4 w-4" />} title="Link wa.me" desc="Padrão. Abre WhatsApp com mensagem pronta." />
          <ModoBtn active={isEvo} onClick={() => setForm({ ...form, integracao_modo: "evolution_api" })} icon={<Plug className="h-4 w-4" />} title="Evolution API" desc="Envio automático via instância própria." />
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Variáveis: <code>{"{{nome_torcedor}} {{nome_bolao}} {{selecao_a}} {{selecao_b}} {{palpite_a}} {{palpite_b}} {{valor_palpite}} {{nome_recebedor}} {{chave_pix}} {{banco}}"}</code>
      </p>

      <Field label="Número de WhatsApp (com DDI/DDD)">
        <input required value={form.numero_whatsapp} onChange={(e) => setForm({ ...form, numero_whatsapp: e.target.value })} className={inputCss} placeholder="5511999999999" />
      </Field>

      {isEvo && (
        <div className="rounded-xl border border-border p-4 space-y-3 bg-muted/30">
          <h2 className="text-sm font-bold">Evolution API</h2>
          <p className="text-xs text-muted-foreground">
            Compatível com{" "}
            <a className="underline" href="https://github.com/evolution-foundation/evolution-go" target="_blank" rel="noreferrer">
              evolution-foundation/evolution-go
            </a>
            . Informe sua URL, API key e o nome da instância já pareada.
          </p>
          <Field label="Base URL"><input value={form.evolution_base_url} onChange={(e) => setForm({ ...form, evolution_base_url: e.target.value })} className={inputCss} placeholder="https://evo.seudominio.com" /></Field>
          <Field label="API Key"><input type="password" value={form.evolution_api_key} onChange={(e) => setForm({ ...form, evolution_api_key: e.target.value })} className={inputCss} placeholder="••••••••" /></Field>
          <Field label="Instância"><input value={form.evolution_instance} onChange={(e) => setForm({ ...form, evolution_instance: e.target.value })} className={inputCss} placeholder="meu-bolao" /></Field>
          <button type="button" onClick={testEvolution} disabled={testing || !form.evolution_base_url || !form.evolution_api_key || !form.evolution_instance} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-xs font-semibold disabled:opacity-60">
            {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plug className="h-3 w-3" />} Testar conexão
          </button>
        </div>
      )}

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

function ModoBtn({ active, onClick, icon, title, desc }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <button type="button" onClick={onClick} className={`text-left rounded-lg border p-3 transition ${active ? "border-pitch bg-pitch/5 ring-2 ring-pitch/30" : "border-border hover:bg-muted/50"}`}>
      <div className="flex items-center gap-2 text-sm font-semibold">{icon}{title}</div>
      <div className="mt-1 text-xs text-muted-foreground">{desc}</div>
    </button>
  );
}

const inputCss = "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-pitch/40 font-mono";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-sm font-medium">{label}</span>{children}</label>;
}
