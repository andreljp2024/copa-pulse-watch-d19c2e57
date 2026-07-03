import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { slugify, DEFAULT_TEMPLATES } from "@/lib/saas";
import {
  maskPhone,
  maskCpf,
  onlyDigits,
  isValidCpf,
  isValidPhoneBR,
} from "@/lib/masks";
import { Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

function isValidChavePix(tipo: string, chave: string): boolean {
  const v = (chave || "").trim();
  if (!v) return false;
  if (tipo === "cpf") return onlyDigits(v).length === 11;
  if (tipo === "cnpj") return onlyDigits(v).length === 14;
  if (tipo === "telefone") return isValidPhoneBR(v);
  if (tipo === "email") return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  if (tipo === "aleatoria") return v.length >= 20;
  return true;
}

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Configurar meu bolão" }] }),
  component: Onboarding,
});

type Step = 1 | 2 | 3 | 4;

function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);

  // Step 1
  const [s1, setS1] = useState({
    nome_responsavel: "",
    cpf_cnpj: "",
    whatsapp: "",
  });
  // Step 2
  const [s2, setS2] = useState({
    nome_recebedor: "",
    tipo_chave_pix: "cpf",
    chave_pix: "",
    banco: "",
    cidade: "",
    valor_padrao_palpite: 10,
    instrucoes_pagamento: "",
  });
  // Step 3
  const [s3, setS3] = useState({
    numero_whatsapp: "",
    mensagem_novo_palpite: DEFAULT_TEMPLATES.novo_palpite,
    mensagem_confirmacao_pagamento: DEFAULT_TEMPLATES.confirmacao_pagamento,
    mensagem_ganhador: DEFAULT_TEMPLATES.ganhador,
    mensagem_lembrete_pagamento: DEFAULT_TEMPLATES.lembrete_pagamento,
  });
  // Step 4
  const [s4, setS4] = useState({ nome: "", slug: "", descricao: "", valor_palpite: 10 });

  // Already onboarded? redirect
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: t } = await supabase
        .from("tenants")
        .select("id, nome_responsavel, whatsapp, cidade, estado")
        .eq("owner_user_id", u.user.id)
        .maybeSingle();
      if (t) {
        setTenantId(t.id);
        setS1((v) => ({
          ...v,
          nome_responsavel: t.nome_responsavel ?? v.nome_responsavel,
          whatsapp: t.whatsapp ? maskPhone(t.whatsapp) : "",
        }));
        // Retomada inteligente: pula para o passo pendente
        const [{ data: pix }, { data: wa }, { data: bo }] = await Promise.all([
          supabase.from("tenant_pix_config").select("tenant_id").eq("tenant_id", t.id).maybeSingle(),
          supabase.from("tenant_whatsapp_config").select("tenant_id").eq("tenant_id", t.id).maybeSingle(),
          supabase.from("boloes").select("id").eq("tenant_id", t.id).limit(1),
        ]);
        if (bo && bo.length > 0) {
          navigate({ to: "/app" });
          return;
        }
        if (pix && wa) setStep(4);
        else if (pix) setStep(3);
        else setStep(2);
      } else {
        // Pré-preencher com metadados do cadastro
        const meta = (u.user.user_metadata ?? {}) as Record<string, string>;
        setS1((v) => ({
          ...v,
          nome_responsavel: meta.nome ?? meta.full_name ?? v.nome_responsavel,
          whatsapp: meta.whatsapp ? maskPhone(meta.whatsapp) : v.whatsapp,
        }));
      }
      setS3((v) => ({
        ...v,
        numero_whatsapp:
          v.numero_whatsapp ||
          (u.user.user_metadata?.whatsapp ? maskPhone(u.user.user_metadata.whatsapp) : ""),
      }));
    })();
  }, [navigate]);

  async function saveStep1() {
    setError(null);
    if (!isValidCpf(s1.cpf_cnpj)) {
      setError("CPF inválido.");
      return;
    }
    setLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sessão expirada");
      const meta = (u.user.user_metadata ?? {}) as Record<string, string>;
      const nome = (s1.nome_responsavel || meta.nome || meta.full_name || "").trim();
      const whatsappDigits = onlyDigits(s1.whatsapp || meta.whatsapp || "");
      if (!nome) {
        setError("Nome não encontrado no cadastro. Contate o suporte.");
        setLoading(false);
        return;
      }
      if (!isValidPhoneBR(whatsappDigits)) {
        setError("WhatsApp não encontrado no cadastro. Contate o suporte.");
        setLoading(false);
        return;
      }
      const payload = {
        nome_responsavel: nome,
        nome_estabelecimento: nome,
        whatsapp: whatsappDigits,
        cpf_cnpj: onlyDigits(s1.cpf_cnpj),
        owner_user_id: u.user.id,
        email: u.user.email ?? "",
      };
      if (tenantId) {
        const { error } = await supabase.from("tenants").update(payload).eq("id", tenantId);
        if (error) throw error;
      } else {
        const { data: insertData, error } = await supabase
          .from("tenants")
          .insert(payload)
          .select("id");
        if (error) throw error;
        const data = Array.isArray(insertData) ? insertData[0] : insertData;
        if (!data) throw new Error("Falha ao criar tenant");
        setTenantId((data as any).id);
      }
      setStep(2);
    } catch (e: any) {
      setError(e?.message || e?.error_description || e?.hint || "Erro ao salvar");
    } finally {
      setLoading(false);
    }
  }

  async function saveStep2() {
    if (!tenantId) return;
    setError(null);
    if (!s2.nome_recebedor.trim()) {
      setError("Informe o nome do recebedor.");
      return;
    }
    if (!isValidChavePix(s2.tipo_chave_pix, s2.chave_pix)) {
      setError("Chave Pix inválida para o tipo selecionado.");
      return;
    }
    if (!(s2.valor_padrao_palpite > 0)) {
      setError("Valor padrão do palpite deve ser maior que zero.");
      return;
    }
    setLoading(true);
    try {
      const chave =
        s2.tipo_chave_pix === "cpf" || s2.tipo_chave_pix === "cnpj" || s2.tipo_chave_pix === "telefone"
          ? onlyDigits(s2.chave_pix)
          : s2.chave_pix.trim();
      const { error } = await supabase
        .from("tenant_pix_config")
        .upsert({ tenant_id: tenantId, ...s2, chave_pix: chave }, { onConflict: "tenant_id" });
      if (error) throw error;
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  async function saveStep3() {
    if (!tenantId) return;
    setError(null);
    if (!isValidPhoneBR(s3.numero_whatsapp)) {
      setError("Número de WhatsApp inválido.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase
        .from("tenant_whatsapp_config")
        .upsert(
          { tenant_id: tenantId, ...s3, numero_whatsapp: onlyDigits(s3.numero_whatsapp) },
          { onConflict: "tenant_id" },
        );
      if (error) throw error;
      setStep(4);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  async function saveStep4() {
    if (!tenantId) return;
    setError(null);
    if (!s4.nome.trim()) {
      setError("Informe o nome do bolão.");
      return;
    }
    const slug = slugify(s4.slug || s4.nome);
    if (slug.length < 3) {
      setError("Slug inválido — use ao menos 3 caracteres.");
      return;
    }
    if (!(s4.valor_palpite > 0)) {
      setError("Valor do palpite deve ser maior que zero.");
      return;
    }
    setLoading(true);
    try {
      // Checagem de unicidade do slug
      const { data: existing } = await supabase
        .from("boloes")
        .select("id")
        .eq("slug", slug)
        .limit(1);
      if (existing && existing.length > 0) {
        setError("Este slug já está em uso. Escolha outro.");
        setLoading(false);
        return;
      }
      const { error } = await supabase.from("boloes").insert({
        tenant_id: tenantId,
        nome: s4.nome.trim(),
        slug,
        descricao: s4.descricao,
        valor_palpite: s4.valor_palpite,
      });
      if (error) throw error;
      navigate({ to: "/app" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  // Ao chegar no step 3, herda o WhatsApp do responsável (evita reentrada duplicada)
  useEffect(() => {
    if (step === 3 && !s3.numero_whatsapp && s1.whatsapp) {
      setS3((v) => ({ ...v, numero_whatsapp: s1.whatsapp }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);


  return (
    <div className="min-h-screen bg-muted/20 py-10">
      <div className="mx-auto max-w-2xl px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-black">Configurar meu bolão</h1>
          <p className="text-sm text-muted-foreground">Passo {step} de 4</p>
          <div className="mt-3 flex items-center gap-2">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="flex flex-1 items-center gap-2">
                <div
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    n < step
                      ? "bg-pitch text-primary-foreground"
                      : n === step
                        ? "bg-pitch text-primary-foreground ring-2 ring-pitch/30"
                        : "bg-muted text-muted-foreground"
                  }`}
                  aria-current={n === step ? "step" : undefined}
                >
                  {n < step ? <Check className="h-3.5 w-3.5" /> : n}
                </div>
                {n < 4 && (
                  <div className={`h-1 flex-1 rounded-full ${n < step ? "bg-pitch" : "bg-muted"}`} />
                )}
              </div>
            ))}
          </div>
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep((s) => (Math.max(1, s - 1) as Step))}
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" /> Voltar ao passo anterior
            </button>
          )}
        </div>


        <div className="rounded-2xl border border-border bg-card p-6">
          {step === 1 && (
            <Form
              title="Dados do responsável / estabelecimento"
              onSubmit={saveStep1}
              loading={loading}
            >
              <Input
                label="Nome do responsável"
                value={s1.nome_responsavel}
                onChange={(v) => setS1({ ...s1, nome_responsavel: v })}
                required
              />
              <Input
                label="CPF"
                value={s1.cpf_cnpj}
                onChange={(v) => setS1({ ...s1, cpf_cnpj: maskCpf(v) })}
                placeholder="000.000.000-00"
                inputMode="numeric"
                required
              />
              <Input
                label="WhatsApp (com DDD)"
                value={s1.whatsapp}
                onChange={(v) => setS1({ ...s1, whatsapp: maskPhone(v) })}
                placeholder="(11) 99999-9999"
                inputMode="tel"
                required
              />
            </Form>
          )}
          {step === 2 && (
            <Form title="Configuração do Pix" onSubmit={saveStep2} loading={loading}>
              <Input
                label="Nome do recebedor"
                value={s2.nome_recebedor}
                onChange={(v) => setS2({ ...s2, nome_recebedor: v })}
                required
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Banco"
                  value={s2.banco}
                  onChange={(v) => setS2({ ...s2, banco: v })}
                />
                <Input
                  label="Cidade"
                  value={s2.cidade}
                  onChange={(v) => setS2({ ...s2, cidade: v })}
                />
              </div>
              <Input
                label="Valor padrão do palpite (R$)"
                type="number"
                value={String(s2.valor_padrao_palpite)}
                onChange={(v) => setS2({ ...s2, valor_padrao_palpite: Number(v) })}
              />
              <Textarea
                label="Instruções de pagamento (opcional)"
                value={s2.instrucoes_pagamento}
                onChange={(v) => setS2({ ...s2, instrucoes_pagamento: v })}
                placeholder={`Ex.: Após o PIX, envie o comprovante no WhatsApp (XX) 9XXXX-XXXX.\nIdentifique o pagamento com seu nome completo e o nome do bolão.\nPalpites são confirmados em até 10 minutos após o envio do comprovante.`}
              />
            </Form>
          )}
          {step === 3 && (
            <Form title="Configuração do WhatsApp" onSubmit={saveStep3} loading={loading}>
              <Input
                label="Número de WhatsApp para receber comprovantes"
                value={s3.numero_whatsapp}
                onChange={(v) => setS3({ ...s3, numero_whatsapp: maskPhone(v) })}
                placeholder="(11) 99999-9999"
                inputMode="tel"
                required
              />
              <p className="text-xs text-muted-foreground">
                Use variáveis como <code>{"{{nome_torcedor}}"}</code>,{" "}
                <code>{"{{nome_bolao}}"}</code>, <code>{"{{chave_pix}}"}</code> nas mensagens.
              </p>
              <Textarea
                label="Mensagem de novo palpite"
                rows={5}
                value={s3.mensagem_novo_palpite}
                onChange={(v) => setS3({ ...s3, mensagem_novo_palpite: v })}
              />
              <Textarea
                label="Mensagem de confirmação de pagamento"
                rows={3}
                value={s3.mensagem_confirmacao_pagamento}
                onChange={(v) => setS3({ ...s3, mensagem_confirmacao_pagamento: v })}
              />
              <Textarea
                label="Mensagem para ganhador"
                rows={3}
                value={s3.mensagem_ganhador}
                onChange={(v) => setS3({ ...s3, mensagem_ganhador: v })}
              />
              <Textarea
                label="Mensagem de lembrete de pagamento"
                rows={3}
                value={s3.mensagem_lembrete_pagamento}
                onChange={(v) => setS3({ ...s3, mensagem_lembrete_pagamento: v })}
              />
            </Form>
          )}
          {step === 4 && (
            <Form title="Criar primeiro bolão" onSubmit={saveStep4} loading={loading}>
              <Input
                label="Nome do bolão"
                value={s4.nome}
                onChange={(v) => setS4({ ...s4, nome: v, slug: s4.slug || slugify(v) })}
                required
              />
              <Input
                label="Slug (link público)"
                value={s4.slug}
                onChange={(v) => setS4({ ...s4, slug: slugify(v) })}
                prefix="/bolao/"
                required
                hint="Identificador do seu bolão na URL pública. Use letras minúsculas, números e hífens (ex.: copa-do-joao). Será o link que você compartilha no WhatsApp."
              />
              <Textarea
                label="Descrição / regras (opcional)"
                value={s4.descricao}
                onChange={(v) => setS4({ ...s4, descricao: v })}
                rows={8}
                placeholder={`Exemplo de regras:

• Valor do palpite: R$ 10 por jogo.
• Acertou o placar exato: 3 pontos. Acertou só o vencedor/empate: 1 ponto.
• Distribuição do prêmio (do total arrecadado):
   - 70% para o 1º colocado
   - 20% para o 2º colocado
   - 10% taxa de administração (organizador)
• Em caso de empate na pontuação, o prêmio é dividido igualmente.
• Palpites só são válidos após confirmação do Pix.
• Não são aceitos palpites após o início da partida.`}
              />

              <Input
                label="Valor do palpite (R$)"
                type="number"
                value={String(s4.valor_palpite)}
                onChange={(v) => setS4({ ...s4, valor_palpite: Number(v) })}
              />
            </Form>
          )}
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}

function Form({
  title,
  children,
  onSubmit,
  loading,
}: {
  title: string;
  children: React.ReactNode;
  onSubmit: () => void;
  loading: boolean;
}) {
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <h2 className="text-xl font-bold">{title}</h2>
      {children}
      <button
        type="submit"
        disabled={loading}
        className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-pitch px-4 font-semibold text-primary-foreground disabled:opacity-60"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <Check className="h-4 w-4" /> Continuar <ChevronRight className="h-4 w-4" />
          </>
        )}
      </button>
    </form>
  );
}

function Input(p: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  prefix?: string;
  placeholder?: string;
  hint?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">
        {p.label}
        {p.required && <span className="text-red-500">*</span>}
      </span>
      <div className="mt-1 flex rounded-lg border border-border bg-background focus-within:ring-2 focus-within:ring-pitch/40">
        {p.prefix && (
          <span className="px-3 py-2 text-sm text-muted-foreground border-r border-border">
            {p.prefix}
          </span>
        )}
        <input
          type={p.type ?? "text"}
          required={p.required}
          placeholder={p.placeholder}
          inputMode={p.inputMode}
          value={p.value}
          onChange={(e) => p.onChange(e.target.value)}
          className="w-full bg-transparent px-3 py-2 text-sm outline-none"
        />
      </div>
      {p.hint && <span className="mt-1 block text-xs text-muted-foreground">{p.hint}</span>}
    </label>
  );
}
function Textarea(p: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{p.label}</span>
      <textarea
        rows={p.rows ?? 3}
        value={p.value}
        placeholder={p.placeholder}
        onChange={(e) => p.onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-pitch/40"
      />
    </label>
  );
}
function Select(p: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{p.label}</span>
      <select
        value={p.value}
        onChange={(e) => p.onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-pitch/40"
      >
        {p.options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
