import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { DEFAULT_TEMPLATES, buildWhatsAppLink, interpolate } from "@/lib/saas";
import { onlyDigits, maskPhone } from "@/lib/masks";
import { PageHeader } from "@/components/PageHeader";
import { Loader2, Save, MessageCircle, AlertCircle, Eye, ExternalLink, RotateCcw, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/whatsapp")({
  component: WhatsAppConfigPage,
});

type TemplateKey =
  | "mensagem_novo_palpite"
  | "mensagem_confirmacao_pagamento"
  | "mensagem_ganhador"
  | "mensagem_lembrete_pagamento";

const TEMPLATES: {
  key: TemplateKey;
  label: string;
  rows: number;
  defaultKey: keyof typeof DEFAULT_TEMPLATES;
}[] = [
  { key: "mensagem_novo_palpite", label: "Novo palpite", rows: 8, defaultKey: "novo_palpite" },
  {
    key: "mensagem_confirmacao_pagamento",
    label: "Confirmação de pagamento",
    rows: 5,
    defaultKey: "confirmacao_pagamento",
  },
  { key: "mensagem_ganhador", label: "Ganhador", rows: 5, defaultKey: "ganhador" },
  {
    key: "mensagem_lembrete_pagamento",
    label: "Lembrete de pagamento",
    rows: 4,
    defaultKey: "lembrete_pagamento",
  },
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

const MAX_TEMPLATE = 1000;

function WhatsAppConfigPage() {
  const [loading, setLoading] = useState(true);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [pixPhoneMasked, setPixPhoneMasked] = useState<string>("");
  const [form, setForm] = useState({
    mensagem_novo_palpite: DEFAULT_TEMPLATES.novo_palpite,
    mensagem_confirmacao_pagamento: DEFAULT_TEMPLATES.confirmacao_pagamento,
    mensagem_ganhador: DEFAULT_TEMPLATES.ganhador,
    mensagem_lembrete_pagamento: DEFAULT_TEMPLATES.lembrete_pagamento,
  });
  const [saving, setSaving] = useState(false);
  const [previewKey, setPreviewKey] = useState<TemplateKey>("mensagem_novo_palpite");
  const textareaRefs = useRef<Partial<Record<TemplateKey, HTMLTextAreaElement | null>>>({});

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    (async () => {
      try {
        const { data: { user }, error: userErr } = await supabase.auth.getUser();
        if (userErr || !user) return;

        const { data: t, error: tErr } = await supabase
          .from("tenants")
          .select("id")
          .eq("owner_user_id", user.id)
          .maybeSingle();
        if (tErr || !t) return;
        setTenantId(t.id);

        const [waRes, pixRes] = await Promise.all([
          supabase.from("tenant_whatsapp_config").select("*").eq("tenant_id", t.id).maybeSingle(),
          supabase
            .from("tenant_pix_config")
            .select("numero_recebedor_whatsapp")
            .eq("tenant_id", t.id)
            .maybeSingle(),
        ]);
        if (waRes.error) {
          toast.error(`Erro ao carregar: ${waRes.error.message}`);
          return;
        }
        const wa = waRes.data;
        if (wa) {
          setForm({
            mensagem_novo_palpite: wa.mensagem_novo_palpite ?? DEFAULT_TEMPLATES.novo_palpite,
            mensagem_confirmacao_pagamento:
              wa.mensagem_confirmacao_pagamento ?? DEFAULT_TEMPLATES.confirmacao_pagamento,
            mensagem_ganhador: wa.mensagem_ganhador ?? DEFAULT_TEMPLATES.ganhador,
            mensagem_lembrete_pagamento:
              wa.mensagem_lembrete_pagamento ?? DEFAULT_TEMPLATES.lembrete_pagamento,
          });
        }
        // Fonte única do número: módulo PIX. Fallback para o que já está gravado no whatsapp_config.
        const pixRaw = pixRes.data?.numero_recebedor_whatsapp ?? "";
        const waRaw = (wa?.numero_whatsapp ?? "").replace(/^55/, "");
        const chosen = onlyDigits(pixRaw) || waRaw;
        setPixPhoneMasked(chosen ? maskPhone(chosen) : "");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const pixPhoneDigits = useMemo(() => onlyDigits(pixPhoneMasked), [pixPhoneMasked]);
  const pixPhoneError = useMemo(() => {
    if (!pixPhoneDigits) return "Nenhum número configurado no módulo Pix";
    if (pixPhoneDigits.length < 10 || pixPhoneDigits.length > 11)
      return "Número do módulo Pix é inválido";
    return null;
  }, [pixPhoneDigits]);

  const templateErrors = useMemo(() => {
    const errs: Partial<Record<TemplateKey, string>> = {};
    for (const t of TEMPLATES) {
      const v = form[t.key];
      if (!v.trim()) errs[t.key] = "Template não pode ficar vazio";
      else if (v.length > MAX_TEMPLATE) errs[t.key] = `Máximo de ${MAX_TEMPLATE} caracteres`;
    }
    return errs;
  }, [form]);

  const previewMessage = useMemo(
    () => interpolate(form[previewKey], PREVIEW_VARS),
    [form, previewKey],
  );

  const fullPhone = pixPhoneDigits ? `55${pixPhoneDigits}` : "";


  const testLink = useMemo(() => {
    if (pixPhoneError || !fullPhone) return null;
    return buildWhatsAppLink(fullPhone, previewMessage);
  }, [fullPhone, pixPhoneError, previewMessage]);

  const hasTemplateErrors = Object.keys(templateErrors).length > 0;
  const canSave = !hasTemplateErrors && !!tenantId;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (hasTemplateErrors) return toast.error("Revise os templates de mensagem.");
    if (!tenantId) return toast.error("Erro ao buscar dados do organizador.");

    setSaving(true);
    try {
      const { error } = await supabase
        .from("tenant_whatsapp_config")
        .upsert({
          tenant_id: tenantId,
          // Fonte única: número gravado no módulo Pix. Sincronizamos aqui para
          // compatibilidade com consumidores existentes (RPC pública, links wa.me).
          numero_whatsapp: fullPhone || null,
          mensagem_novo_palpite: form.mensagem_novo_palpite.trim(),
          mensagem_confirmacao_pagamento: form.mensagem_confirmacao_pagamento.trim(),
          mensagem_ganhador: form.mensagem_ganhador.trim(),
          mensagem_lembrete_pagamento: form.mensagem_lembrete_pagamento.trim(),
          integracao_modo: "link",
        }, { onConflict: "tenant_id" });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Configuração salva!");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar configuração");
    } finally {
      setSaving(false);
    }
  }


  function resetTemplate(key: TemplateKey, defKey: keyof typeof DEFAULT_TEMPLATES) {
    update(key, DEFAULT_TEMPLATES[defKey]);
    toast.success("Template restaurado para o padrão.");
  }

  function insertVariable(key: TemplateKey, variable: string) {
    const token = `{{${variable}}}`;
    const el = textareaRefs.current[key];
    const current = form[key];
    if (el && document.activeElement === el) {
      const start = el.selectionStart ?? current.length;
      const end = el.selectionEnd ?? current.length;
      const next = current.slice(0, start) + token + current.slice(end);
      update(key, next.slice(0, MAX_TEMPLATE));
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + token.length;
        el.setSelectionRange(pos, pos);
      });
    } else {
      const sep = current.endsWith(" ") || current.length === 0 ? "" : " ";
      update(key, `${current}${sep}${token}`.slice(0, MAX_TEMPLATE));
    }
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
        subtitle="Defina o número de WhatsApp para receber notificações dos participantes."
        icon={<MessageCircle className="h-5 w-5" />}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <form onSubmit={handleSave} className="space-y-6">
          <Section
            title="Número do recebedor"
            description="Número do WhatsApp que aparece nos links wa.me."
            icon={<Phone className="h-4 w-4 text-gold" />}
          >
            <Field label="WhatsApp (DDD + número)" required>
              <div className="relative mt-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-mono text-muted-foreground select-none">
                  +55
                </span>
                <input
                  required
                  inputMode="numeric"
                  value={form.numero_whatsapp}
                  onChange={(e) => update("numero_whatsapp", maskPhone(e.target.value))}
                  className={`${inputCss} font-mono pl-12 ${phoneError ? "border-destructive/60 focus:ring-destructive/40" : ""}`}
                  placeholder="(11) 99999-9999"
                  maxLength={16}
                />
              </div>
              {phoneError ? (
                <p className="mt-1 inline-flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="h-3 w-3" /> {phoneError}
                </p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  DDI +55 (Brasil) incluso automaticamente. Informe DDD + número.
                </p>
              )}
            </Field>
          </Section>


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

            {TEMPLATES.map((tpl) => {
              const value = form[tpl.key];
              const err = templateErrors[tpl.key];
              const isActive = previewKey === tpl.key;
              return (
                <Field key={tpl.key} label={tpl.label}>
                  <div className="relative">
                    <textarea
                      ref={(el) => {
                        textareaRefs.current[tpl.key] = el;
                      }}
                      rows={tpl.rows}
                      value={value}
                      maxLength={MAX_TEMPLATE}
                      onFocus={() => setPreviewKey(tpl.key)}
                      onChange={(e) => update(tpl.key, e.target.value)}
                      className={`${inputCss} font-mono text-xs pr-2 pt-8 ${
                        err ? "border-destructive/60 focus:ring-destructive/40" : ""
                      } ${isActive ? "ring-1 ring-gold/30" : ""}`}
                    />
                    <button
                      type="button"
                      onClick={() => resetTemplate(tpl.key, tpl.defaultKey)}
                      title="Restaurar padrão"
                      className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-0.5 text-[10px] font-semibold text-muted-foreground hover:text-foreground hover:border-gold/40"
                    >
                      <RotateCcw className="h-3 w-3" /> Padrão
                    </button>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px]">
                    {err ? (
                      <span className="inline-flex items-center gap-1 text-destructive">
                        <AlertCircle className="h-3 w-3" /> {err}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        {isActive ? "Editando — visível na pré-visualização" : "Clique para pré-visualizar"}
                      </span>
                    )}
                    <span
                      className={`font-mono ${value.length > MAX_TEMPLATE * 0.9 ? "text-destructive" : "text-muted-foreground"}`}
                    >
                      {value.length}/{MAX_TEMPLATE}
                    </span>
                  </div>
                </Field>
              );
            })}
          </Section>

          <button
            type="submit"
            disabled={saving || !canSave}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-gold px-5 font-semibold text-gold-foreground shadow-gold disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar configuração
          </button>
        </form>


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
                <ExternalLink className="h-4 w-4" /> Abrir wa.me
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
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  );
}