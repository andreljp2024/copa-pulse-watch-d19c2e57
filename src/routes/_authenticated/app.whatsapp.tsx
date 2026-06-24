import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_TEMPLATES, buildWhatsAppLink, interpolate } from "@/lib/saas";
import { onlyDigits } from "@/lib/masks";
import { PageHeader } from "@/components/PageHeader";
import {
  Loader2,
  Save,
  Link2,
  Plug,
  MessageCircle,
  Phone,
  Send,
  AlertCircle,
  CheckCircle2,
  Eye,
  ExternalLink,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/whatsapp")({
  component: WhatsAppConfigPage,
});

type Modo = "link" | "evolution_api";

type TemplateKey =
  | "mensagem_novo_palpite"
  | "mensagem_confirmacao_pagamento"
  | "mensagem_ganhador"
  | "mensagem_lembrete_pagamento";

const TEMPLATES: { key: TemplateKey; label: string; rows: number; defaultKey: keyof typeof DEFAULT_TEMPLATES }[] = [
  { key: "mensagem_novo_palpite", label: "Novo palpite", rows: 8, defaultKey: "novo_palpite" },
  { key: "mensagem_confirmacao_pagamento", label: "Confirmação de pagamento", rows: 5, defaultKey: "confirmacao_pagamento" },
  { key: "mensagem_ganhador", label: "Ganhador", rows: 5, defaultKey: "ganhador" },
  { key: "mensagem_lembrete_pagamento", label: "Lembrete de pagamento", rows: 4, defaultKey: "lembrete_pagamento" },
];

const VARIAVEIS = [
  "nome_torcedor",
  "whatsapp_torcedor",
  "nome_bolao",
  "selecao_a",
  "selecao_b",
  "palpite_a",
  "palpite_b",
  "placar_a",
  "placar_b",
  "valor_palpite",
  "nome_recebedor",
  "chave_pix",
  "banco",
];

const PREVIEW_VARS: Record<string, string> = {
  nome_torcedor: "João Silva",
  whatsapp_torcedor: "(11) 99999-9999",
  nome_bolao: "Bolão da Copa",
  selecao_a: "Brasil",
  selecao_b: "Argentina",
  palpite_a: "2",
  palpite_b: "1",
  placar_a: "2",
  placar_b: "1",
  valor_palpite: "10,00",
  nome_recebedor: "João da Silva",
  chave_pix: "joao@email.com",
  banco: "Nubank",
};

function validatePhone(v: string): string | null {
  const d = onlyDigits(v);
  if (!d) return "Informe o número";
  if (d.length < 12 || d.length > 13) return "Use DDI + DDD + número (ex.: 5511999999999)";
  if (!d.startsWith("55")) return "Inclua o DDI 55 (Brasil)";
  return null;
}

function WhatsAppConfigPage() {
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
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
  const [evoStatus, setEvoStatus] = useState<"idle" | "ok" | "fail">("idle");
  const [previewKey, setPreviewKey] = useState<TemplateKey>("mensagem_novo_palpite");

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: t } = await supabase
        .from("tenants")
        .select("id")
        .eq("owner_user_id", u.user.id)
        .single();
      if (!t) {
        setLoading(false);
        return;
      }
      setTenantId(t.id);
      const { data: wa } = await supabase
        .from("tenant_whatsapp_config")
        .select("*")
        .eq("tenant_id", t.id)
        .maybeSingle();
      if (wa) {
        const w = wa as unknown as Record<string, string | null>;
        setForm({
          numero_whatsapp: w.numero_whatsapp ?? "",
          mensagem_novo_palpite: w.mensagem_novo_palpite ?? DEFAULT_TEMPLATES.novo_palpite,
          mensagem_confirmacao_pagamento:
            w.mensagem_confirmacao_pagamento ?? DEFAULT_TEMPLATES.confirmacao_pagamento,
          mensagem_ganhador: w.mensagem_ganhador ?? DEFAULT_TEMPLATES.ganhador,
          mensagem_lembrete_pagamento:
            w.mensagem_lembrete_pagamento ?? DEFAULT_TEMPLATES.lembrete_pagamento,
          integracao_modo: ((w.integracao_modo as Modo) ?? "link"),
          evolution_base_url: w.evolution_base_url ?? "",
          evolution_api_key: w.evolution_api_key ?? "",
          evolution_instance: w.evolution_instance ?? "",
        });
      }
      setLoading(false);
    })();
  }, []);

  const phoneError = useMemo(
    () => (form.numero_whatsapp ? validatePhone(form.numero_whatsapp) : null),
    [form.numero_whatsapp],
  );

  const isEvo = form.integracao_modo === "evolution_api";

  const previewMessage = useMemo(
    () => interpolate(form[previewKey], PREVIEW_VARS),
    [form, previewKey],
  );

  const testLink = useMemo(() => {
    if (phoneError || !form.numero_whatsapp) return null;
    return buildWhatsAppLink(form.numero_whatsapp, previewMessage);
  }, [form.numero_whatsapp, phoneError, previewMessage]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!tenantId) return;
    if (phoneError) {
      toast.error(phoneError);
      return;
    }
    setSaving(true);
    const payload = {
      tenant_id: tenantId,
      ...form,
      numero_whatsapp: onlyDigits(form.numero_whatsapp),
    };
    const { error } = await supabase
      .from("tenant_whatsapp_config")
      .upsert(payload as never, { onConflict: "tenant_id" });
    setSaving(false);
    if (error) toast.error(`Erro ao salvar: ${error.message}`);
    else toast.success("Configuração do WhatsApp salva!");
  }

  async function testEvolution() {
    setTesting(true);
    setEvoStatus("idle");
    try {
      const url = form.evolution_base_url.replace(/\/$/, "");
      const r = await fetch(
        `${url}/instance/connectionState/${encodeURIComponent(form.evolution_instance)}`,
        { headers: { apikey: form.evolution_api_key } },
      );
      if (r.ok) {
        setEvoStatus("ok");
        toast.success("Conexão com Evolution API estabelecida.");
      } else {
        setEvoStatus("fail");
        toast.error(`Falha na conexão (HTTP ${r.status}).`);
      }
    } catch (err) {
      setEvoStatus("fail");
      toast.error(`Erro: ${(err as Error).message}`);
    } finally {
      setTesting(false);
    }
  }

  function resetTemplate(key: TemplateKey, defKey: keyof typeof DEFAULT_TEMPLATES) {
    setForm((f) => ({ ...f, [key]: DEFAULT_TEMPLATES[defKey] }));
    toast.success("Template restaurado para o padrão.");
  }

  function insertVariable(key: TemplateKey, variable: string) {
    setForm((f) => ({ ...f, [key]: `${f[key]} {{${variable}}}` }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuração do WhatsApp"
        subtitle="Defina como suas mensagens automáticas chegam ao torcedor."
        icon={<MessageCircle className="h-5 w-5" />}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <form onSubmit={save} className="space-y-6">
          <Section
            title="Modo de integração"
            description="Como o sistema envia as mensagens."
            icon={<Plug className="h-4 w-4 text-gold" />}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ModoBtn
                active={!isEvo}
                onClick={() => setForm({ ...form, integracao_modo: "link" })}
                icon={<Link2 className="h-4 w-4" />}
                title="Link wa.me"
                desc="Padrão. Abre o WhatsApp com a mensagem pronta — o torcedor envia."
              />
              <ModoBtn
                active={isEvo}
                onClick={() => setForm({ ...form, integracao_modo: "evolution_api" })}
                icon={<Plug className="h-4 w-4" />}
                title="Evolution API"
                desc="Envio automático pelo servidor através de uma instância própria."
              />
            </div>
          </Section>

          <Section
            title="Número do recebedor"
            description="WhatsApp que aparece nos links wa.me."
            icon={<Phone className="h-4 w-4 text-gold" />}
          >
            <Field label="Número (DDI + DDD + número, só dígitos)" required>
              <input
                required
                inputMode="numeric"
                value={form.numero_whatsapp}
                onChange={(e) =>
                  setForm({ ...form, numero_whatsapp: onlyDigits(e.target.value) })
                }
                className={`${inputCss} font-mono ${phoneError ? "border-destructive/60 focus:ring-destructive/40" : ""}`}
                placeholder="5511999999999"
                maxLength={13}
              />
              {phoneError ? (
                <p className="mt-1 inline-flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="h-3 w-3" /> {phoneError}
                </p>
              ) : (
                <Hint>Ex.: 55 (Brasil) + 11 (DDD) + 999999999</Hint>
              )}
            </Field>
          </Section>

          {isEvo && (
            <Section
              title="Evolution API"
              description="Conecte sua instância para enviar mensagens automaticamente."
              icon={<Send className="h-4 w-4 text-gold" />}
            >
              <p className="text-xs text-muted-foreground">
                Compatível com{" "}
                <a
                  className="underline hover:text-gold"
                  href="https://github.com/evolution-foundation/evolution-go"
                  target="_blank"
                  rel="noreferrer"
                >
                  evolution-foundation/evolution-go
                </a>
                .
              </p>
              <Field label="Base URL" required>
                <input
                  value={form.evolution_base_url}
                  onChange={(e) => setForm({ ...form, evolution_base_url: e.target.value })}
                  className={inputCss}
                  placeholder="https://evo.seudominio.com"
                />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="API Key" required>
                  <input
                    type="password"
                    value={form.evolution_api_key}
                    onChange={(e) => setForm({ ...form, evolution_api_key: e.target.value })}
                    className={inputCss}
                    placeholder="••••••••"
                  />
                </Field>
                <Field label="Instância" required>
                  <input
                    value={form.evolution_instance}
                    onChange={(e) => setForm({ ...form, evolution_instance: e.target.value })}
                    className={inputCss}
                    placeholder="meu-bolao"
                  />
                </Field>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={testEvolution}
                  disabled={
                    testing ||
                    !form.evolution_base_url ||
                    !form.evolution_api_key ||
                    !form.evolution_instance
                  }
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-semibold hover:border-gold/40 transition-colors disabled:opacity-60"
                >
                  {testing ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Plug className="h-3 w-3" />
                  )}
                  Testar conexão
                </button>
                {evoStatus === "ok" && (
                  <span className="inline-flex items-center gap-1 text-xs text-pitch">
                    <CheckCircle2 className="h-3 w-3" /> Conectado
                  </span>
                )}
                {evoStatus === "fail" && (
                  <span className="inline-flex items-center gap-1 text-xs text-destructive">
                    <AlertCircle className="h-3 w-3" /> Falhou
                  </span>
                )}
              </div>
            </Section>
          )}

          <Section
            title="Templates de mensagem"
            description="Use as variáveis abaixo — elas são substituídas no envio."
            icon={<MessageCircle className="h-4 w-4 text-gold" />}
          >
            <div className="flex flex-wrap gap-1.5">
              {VARIAVEIS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => insertVariable(previewKey, v)}
                  title={`Inserir em "${TEMPLATES.find((t) => t.key === previewKey)?.label}"`}
                  className="rounded-md border border-border bg-card px-2 py-0.5 text-[11px] font-mono hover:border-gold/40 hover:text-gold transition-colors"
                >
                  {`{{${v}}}`}
                </button>
              ))}
            </div>

            {TEMPLATES.map((tpl) => (
              <Field key={tpl.key} label={tpl.label}>
                <div className="relative">
                  <textarea
                    rows={tpl.rows}
                    value={form[tpl.key]}
                    onFocus={() => setPreviewKey(tpl.key)}
                    onChange={(e) => setForm({ ...form, [tpl.key]: e.target.value })}
                    className={`${inputCss} font-mono text-xs`}
                  />
                  <button
                    type="button"
                    onClick={() => resetTemplate(tpl.key, tpl.defaultKey)}
                    className="absolute right-2 top-2 rounded-md border border-border bg-card px-2 py-0.5 text-[10px] font-semibold text-muted-foreground hover:text-foreground hover:border-gold/40"
                  >
                    Restaurar padrão
                  </button>
                </div>
              </Field>
            ))}
          </Section>

          <div className="flex items-center gap-3">
            <button
              disabled={saving || !!phoneError}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-gold px-5 font-semibold text-gold-foreground shadow-gold disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar configuração
            </button>
          </div>
        </form>

        {/* Pré-visualização */}
        <aside className="lg:sticky lg:top-6 self-start">
          <div className="rounded-2xl border border-gold/30 bg-gradient-card p-5 card-elevated">
            <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gold">
              <Eye className="h-3.5 w-3.5" /> Pré-visualização
            </div>
            <h3 className="mt-1 font-display text-lg font-bold">
              {TEMPLATES.find((t) => t.key === previewKey)?.label}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Variáveis preenchidas com dados de exemplo.
            </p>

            <div className="mt-4 rounded-xl bg-[#0b141a] p-3">
              <div className="rounded-lg bg-[#005c4b] p-3 text-sm leading-relaxed text-white shadow-md whitespace-pre-wrap break-words max-w-full">
                {previewMessage}
              </div>
            </div>

            {testLink ? (
              <a
                href={testLink}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold hover:border-gold/40 transition-colors"
              >
                <ExternalLink className="h-4 w-4" /> Abrir teste no WhatsApp
              </a>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                Informe um número válido para testar.
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function ModoBtn({
  active,
  onClick,
  icon,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-xl border p-3 transition ${
        active
          ? "border-gold bg-gold/5 ring-2 ring-gold/30 shadow-gold"
          : "border-border bg-card hover:border-gold/40 hover:bg-muted/40"
      }`}
    >
      <div className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{desc}</div>
    </button>
  );
}

const inputCss =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/40 transition-shadow";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </span>
      {children}
    </label>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-xs text-muted-foreground">{children}</p>;
}

function Section({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-gradient-card p-5 card-elevated space-y-4">
      <header className="flex items-start gap-3">
        {icon && (
          <div className="grid h-9 w-9 place-items-center rounded-lg border border-gold/30 bg-card">
            {icon}
          </div>
        )}
        <div>
          <h3 className="font-display text-base font-bold">{title}</h3>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
