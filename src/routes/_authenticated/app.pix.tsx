import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

import { buildPixPayload } from "@/lib/pix";
import { brl } from "@/lib/saas";
import {
  maskCpfCnpj,
  maskPhone,
  onlyDigits,
  isValidCpf,
  isValidCnpj,
  isValidPhoneBR,
} from "@/lib/masks";
import {
  Loader2,
  Save,
  CreditCard,
  Copy,
  Check,
  QrCode,
  ShieldCheck,
  AlertCircle,
  Eye,
} from "lucide-react";

const MODELO_INSTRUCOES = `💰 *Instruções de pagamento* 💰

✅ *1.* Copie a chave Pix ou use o QR Code acima 📲
✅ *2.* Efetue o pagamento no valor do palpite 💵
✅ *3.* Envie o comprovante no WhatsApp 📎

⚠️ *Importante:* seu palpite só é confirmado após o pagamento ser validado pelo organizador. ⏳
🕐 Palpites não são aceitos após o início da partida.

🍀 Boa sorte e que vença o melhor palpiteiro! 🏆⚽`;

export const Route = createFileRoute("/_authenticated/app/pix")({
  component: PixConfigPage,
});

type TipoChave = "cpf" | "cnpj" | "email" | "telefone" | "aleatoria";

const TIPOS: { value: TipoChave; label: string; hint: string }[] = [
  { value: "cpf", label: "CPF", hint: "000.000.000-00" },
  { value: "cnpj", label: "CNPJ", hint: "00.000.000/0000-00" },
  { value: "email", label: "E-mail", hint: "voce@email.com" },
  { value: "telefone", label: "Telefone", hint: "(11) 99999-9999" },
  { value: "aleatoria", label: "Aleatória", hint: "chave UUID gerada pelo banco" },
];

function formatChave(tipo: TipoChave, raw: string): string {
  if (tipo === "cpf" || tipo === "cnpj") return maskCpfCnpj(raw);
  if (tipo === "telefone") return maskPhone(raw);
  return raw.trim();
}

function validateChave(tipo: TipoChave, raw: string): string | null {
  const v = raw.trim();
  if (!v) return "Informe a chave Pix";
  if (tipo === "cpf") return isValidCpf(v) ? null : "CPF inválido";
  if (tipo === "cnpj") return isValidCnpj(v) ? null : "CNPJ inválido";
  if (tipo === "telefone") return isValidPhoneBR(v) ? null : "Telefone inválido";
  if (tipo === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : "E-mail inválido";
  if (tipo === "aleatoria")
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
      ? null
      : "Chave aleatória deve ser um UUID";
  return null;
}

/** Devolve a chave no formato aceito pelo BR Code (BACEN). */
function chaveForPayload(tipo: TipoChave, raw: string): string {
  const v = raw.trim();
  if (tipo === "cpf" || tipo === "cnpj") return onlyDigits(v);
  if (tipo === "telefone") return `+55${onlyDigits(v)}`;
  return v;
}

function PixConfigPage() {
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    nome_recebedor: "",
    tipo_chave_pix: "cpf" as TipoChave,
    chave_pix: "",
    banco: "",
    cidade: "",
    valor_padrao_palpite: 10,
    instrucoes_pagamento: MODELO_INSTRUCOES,
    numero_recebedor_whatsapp: "",
  });
  const [saving, setSaving] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) {
          console.log("[Pix] Usuário não autenticado");
          setLoading(false);
          return;
        }
        
        const tRes = await supabase
          .from("tenants")
          .select("id")
          .eq("owner_user_id", u.user.id)
          .limit(1);
        
        if (tRes.error) {
          console.error("[Pix] Erro ao buscar tenant:", tRes.error);
          setLoading(false);
          return;
        }
        
        const t = Array.isArray(tRes.data) ? tRes.data[0] : tRes.data;
        if (!t?.id) {
          console.log("[Pix] Tenant não encontrado");
          setLoading(false);
          return;
        }
        
        setTenantId(t.id);
        console.log("[Pix] Tenant ID carregado:", t.id);
        
        const pixRes = await supabase
          .from("tenant_pix_config")
          .select("*")
          .eq("tenant_id", t.id)
          .maybeSingle();
        
        if (pixRes.error) {
          console.error("[Pix] Erro ao buscar configuração Pix:", pixRes.error);
        } else if (pixRes.data) {
          console.log("[Pix] Configuração carregada:", pixRes.data);
          const tipo = (pixRes.data.tipo_chave_pix as TipoChave) ?? "cpf";
          setForm({
            nome_recebedor: pixRes.data.nome_recebedor ?? "",
            tipo_chave_pix: tipo,
            chave_pix: formatChave(tipo, pixRes.data.chave_pix ?? ""),
            banco: pixRes.data.banco ?? "",
            cidade: pixRes.data.cidade ?? "",
            valor_padrao_palpite: Number(pixRes.data.valor_padrao_palpite ?? 10),
            instrucoes_pagamento: pixRes.data.instrucoes_pagamento ?? MODELO_INSTRUCOES,
            numero_recebedor_whatsapp: maskPhone(pixRes.data.numero_recebedor_whatsapp ?? ""),
          });
        } else {
          console.log("[Pix] Nenhuma configuração encontrada");
        }
      } catch (err) {
        console.error("[Pix] Erro inesperado:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const chaveError = useMemo(
    () => (form.chave_pix ? validateChave(form.tipo_chave_pix, form.chave_pix) : null),
    [form.tipo_chave_pix, form.chave_pix],
  );

  const whatsappError = useMemo(() => {
    const v = form.numero_recebedor_whatsapp.trim();
    if (!v) return null;
    return isValidPhoneBR(v) ? null : "WhatsApp inválido";
  }, [form.numero_recebedor_whatsapp]);

  const cidadeWarn = form.cidade.trim().length === 0;
  const nomeError = form.nome_recebedor.trim().length === 0 ? "Informe o nome" : null;

  const canPreview = !!form.nome_recebedor && !!form.chave_pix && !chaveError;
  const canSave = !nomeError && !chaveError && !whatsappError && !!form.chave_pix;

  const payload = useMemo(() => {
    if (!canPreview) return "";
    try {
      return buildPixPayload({
        chave: chaveForPayload(form.tipo_chave_pix, form.chave_pix),
        nomeRecebedor: form.nome_recebedor,
        cidade: form.cidade || "BRASIL",
        valor: Number(form.valor_padrao_palpite) || 0,
        descricao: "Palpite",
      });
    } catch {
      return "";
    }
  }, [canPreview, form]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!tenantId) return;
    if (!canSave) {
      toast.error(chaveError ?? whatsappError ?? nomeError ?? "Revise os campos");
      return;
    }
    setSaving(true);
    // Normaliza para armazenamento (sem máscara em CPF/CNPJ/telefone).
    const chaveNormalizada =
      form.tipo_chave_pix === "cpf" ||
      form.tipo_chave_pix === "cnpj" ||
      form.tipo_chave_pix === "telefone"
        ? onlyDigits(form.chave_pix)
        : form.chave_pix.trim();
    const whats = onlyDigits(form.numero_recebedor_whatsapp);
    const valor = Number(form.valor_padrao_palpite);
    const payload = {
      tenant_id: tenantId,
      nome_recebedor: form.nome_recebedor.trim(),
      tipo_chave_pix: form.tipo_chave_pix,
      chave_pix: chaveNormalizada,
      banco: form.banco.trim() || null,
      cidade: form.cidade.trim() || null,
      valor_padrao_palpite: Number.isFinite(valor) && valor >= 0 ? valor : 0,
      instrucoes_pagamento: form.instrucoes_pagamento.trim() || null,
      numero_recebedor_whatsapp: whats || null,
    };
    const { error } = await supabase
      .from("tenant_pix_config")
      .upsert(payload, { onConflict: "tenant_id" });
    setSaving(false);
    if (error) {
      toast.error(`Erro ao salvar: ${error.message}`);
      return;
    }
    // Reflete a chave normalizada de volta com máscara na UI.
    update("chave_pix", formatChave(form.tipo_chave_pix, chaveNormalizada));
    toast.success("Configuração Pix salva com sucesso!");
  }


  async function copyCode() {
    if (!payload) return;
    await navigator.clipboard.writeText(payload);
    setCopiedCode(true);
    toast.success("Código Pix copiado");
    setTimeout(() => setCopiedCode(false), 1800);
  }

  const tipoHint = TIPOS.find((t) => t.value === form.tipo_chave_pix)?.hint;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HERO */}
      <div className="relative overflow-hidden rounded-3xl border border-gold/30 bg-hero p-6 sm:p-8 shadow-card">
        <div className="pointer-events-none absolute inset-0 bg-mesh opacity-70" />
        <div className="pointer-events-none absolute -top-16 -right-10 h-64 w-64 rounded-full bg-gold/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-16 h-72 w-72 rounded-full bg-pitch/30 blur-3xl" />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-background/40 px-3 py-1 text-xs font-semibold text-gold backdrop-blur">
            <CreditCard className="h-3.5 w-3.5" /> Cobrança Pix
          </span>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl font-black tracking-tight">
            Configuração do <span className="text-gradient-gold">Pix</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
            Dados usados nas mensagens automáticas, na página pública e no QR Code de cobrança.
          </p>
        </div>
      </div>


      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Formulário */}
        <form onSubmit={save} className="space-y-6">
          <Section
            title="Recebedor"
            description="Como você aparece para o pagador."
            icon={<ShieldCheck className="h-4 w-4 text-gold" />}
          >
            <Field label="Nome do recebedor" required>
              <input
                required
                maxLength={25}
                value={form.nome_recebedor}
                onChange={(e) => setForm({ ...form, nome_recebedor: e.target.value })}
                className={inputCss}
                placeholder="Ex.: João da Silva"
              />
              <Hint>Até 25 caracteres (limite do padrão BR Code).</Hint>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Banco">
                <input
                  value={form.banco}
                  onChange={(e) => setForm({ ...form, banco: e.target.value })}
                  className={inputCss}
                  placeholder="Ex.: Nubank"
                />
              </Field>
              <Field label="Cidade">
                <input
                  maxLength={15}
                  value={form.cidade}
                  onChange={(e) => update("cidade", e.target.value)}
                  className={inputCss}
                  placeholder="Ex.: SAO PAULO"
                />
                {cidadeWarn ? (
                  <Hint>Se vazio, será usado "BRASIL" no QR Code.</Hint>
                ) : (
                  <Hint>Sem acentos, até 15 caracteres (padrão BR Code).</Hint>
                )}
              </Field>
            </div>
          </Section>

          <Section
            title="Chave Pix"
            description="Tipo da chave e valor padrão usado na cobrança."
            icon={<QrCode className="h-4 w-4 text-gold" />}
          >
            <Field label="Tipo de chave" required>
              <select
                value={form.tipo_chave_pix}
                onChange={(e) =>
                  setForm({
                    ...form,
                    tipo_chave_pix: e.target.value as TipoChave,
                    chave_pix: "",
                  })
                }
                className={inputCss}
              >
                {TIPOS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Chave Pix" required>
              <input
                required
                value={form.chave_pix}
                onChange={(e) =>
                  setForm({
                    ...form,
                    chave_pix: formatChave(form.tipo_chave_pix, e.target.value),
                  })
                }
                className={`${inputCss} ${chaveError ? "border-destructive/60 focus:ring-destructive/40" : ""}`}
                placeholder={tipoHint}
                inputMode={
                  form.tipo_chave_pix === "cpf" ||
                  form.tipo_chave_pix === "cnpj" ||
                  form.tipo_chave_pix === "telefone"
                    ? "numeric"
                    : "text"
                }
              />
              {chaveError ? (
                <p className="mt-1 inline-flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="h-3 w-3" /> {chaveError}
                </p>
              ) : (
                <Hint>Formato esperado: {tipoHint}</Hint>
              )}
            </Field>

            <Field label="Valor padrão do palpite">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  R$
                </span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.valor_padrao_palpite}
                  onChange={(e) =>
                    setForm({ ...form, valor_padrao_palpite: Number(e.target.value) })
                  }
                  className={`${inputCss} pl-9`}
                />
              </div>
              <Hint>Usado para gerar a cobrança Pix com valor pré-preenchido.</Hint>
            </Field>
          </Section>

          <Section
            title="Mensagem ao pagador"
            description="Texto exibido na página pública do bolão."
          >
            <Field label="Instruções de pagamento">
              <textarea
                rows={10}
                value={form.instrucoes_pagamento}
                onChange={(e) => setForm({ ...form, instrucoes_pagamento: e.target.value })}
                className={`${inputCss} font-mono text-xs whitespace-pre-wrap`}
                placeholder={MODELO_INSTRUCOES}
              />
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, instrucoes_pagamento: MODELO_INSTRUCOES })}
                  className="inline-flex items-center gap-1 rounded-md border border-gold/40 bg-gold/10 px-2.5 py-1 text-xs font-semibold text-gold hover:bg-gold/20"
                >
                  Usar modelo com emojis
                </button>
              </div>
            </Field>
            <Field label="WhatsApp do recebedor">
              <input
                value={form.numero_recebedor_whatsapp}
                onChange={(e) => update("numero_recebedor_whatsapp", maskPhone(e.target.value))}
                className={`${inputCss} ${whatsappError ? "border-destructive/60 focus:ring-destructive/40" : ""}`}
                placeholder="(11) 99999-9999"
                inputMode="numeric"
              />
              {whatsappError ? (
                <p className="mt-1 inline-flex items-center gap-1 text-xs text-destructive">
                  <AlertCircle className="h-3 w-3" /> {whatsappError}
                </p>
              ) : (
                <Hint>Opcional. Número para contato direto com o recebedor.</Hint>
              )}
            </Field>
          </Section>

          <div className="flex items-center gap-3">
            <button
              disabled={saving || !canSave}
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
            <h3 className="mt-1 font-display text-lg font-bold">QR Code & Copia e Cola</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              É exatamente isso que o torcedor verá na página pública.
            </p>

            {canPreview && payload ? (
              <>
                <div className="mt-4 flex justify-center rounded-xl bg-white p-4">
                  <QRCodeSVG value={payload} size={200} level="M" includeMargin={false} />
                </div>
                <div className="mt-4 space-y-1 text-sm">
                  <p>
                    <span className="text-muted-foreground">Recebedor:</span>{" "}
                    <strong>{form.nome_recebedor}</strong>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Valor:</span>{" "}
                    <strong className="text-gold">
                      {brl(Number(form.valor_padrao_palpite) || 0)}
                    </strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={copyCode}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold hover:border-gold/40 transition-colors"
                >
                  {copiedCode ? (
                    <>
                      <Check className="h-4 w-4 text-pitch" /> Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" /> Copiar código Pix
                    </>
                  )}
                </button>
              </>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Preencha nome do recebedor e uma chave Pix válida para gerar o QR Code.
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
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
