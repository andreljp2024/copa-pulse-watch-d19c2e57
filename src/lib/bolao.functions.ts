import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const waConfigSchema = z.object({
  numero_whatsapp: z
    .string()
    .min(1, "Número é obrigatório")
    .regex(/^\d{12,13}$/, "Número inválido"),
  mensagem_novo_palpite: z.string().optional().nullable(),
  mensagem_confirmacao_pagamento: z.string().optional().nullable(),
  mensagem_ganhador: z.string().optional().nullable(),
  mensagem_lembrete_pagamento: z.string().optional().nullable(),
});

const saveBolaoSchema = z.object({
  bolao_id: z.string().uuid("ID do bolão inválido"),
  nome: z.string().trim().min(1, "Nome é obrigatório").max(120, "Nome muito longo"),
  slug: z
    .string()
    .trim()
    .min(1, "Slug é obrigatório")
    .max(80, "Slug muito longo")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug deve conter apenas letras, números e hífens"),
  descricao: z.string().max(500, "Descrição muito longa").optional().nullable(),
  regras: z.string().max(5000, "Regras muito longas").optional().nullable(),
  valor_palpite: z
    .number()
    .finite("Valor do palpite inválido")
    .min(0.01, "Valor do palpite deve ser maior que zero"),
  percentual_admin: z
    .number()
    .finite("Percentual admin inválido")
    .min(0, "Percentual admin mínimo é 0")
    .max(100, "Percentual admin máximo é 100"),
  permitir_ranking_publico: z.boolean(),
  permitir_ganhadores_publico: z.boolean(),
  data_limite_palpite: z.string().nullable().optional(),
  match_ids: z.array(z.string().uuid("ID de jogo inválido")),
});

export type SaveBolaoInput = z.infer<typeof saveBolaoSchema>;
export type SaveBolaoResult = { ok: true; message: string } | { ok: false; message: string };

const saveBolaoMatchesSchema = z.object({
  bolao_id: z.string().uuid("ID do bolão inválido"),
  match_ids: z.array(z.string().uuid("ID de jogo inválido")),
});

export const saveBolaoMatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => saveBolaoMatchesSchema.parse(d))
  .handler(async ({ data, context }) => {
    try {
      const { error: delErr } = await context.supabase
        .from("bolao_matches")
        .delete()
        .eq("bolao_id", data.bolao_id);
      if (delErr) {
        console.error("[saveBolaoMatches] Erro ao remover jogos antigos:", delErr);
        return { ok: false, message: "Erro ao limpar jogos: " + delErr.message };
      }

      const rows = data.match_ids.map((mid) => ({ bolao_id: data.bolao_id, match_id: mid }));
      if (rows.length > 0) {
        const { error: insErr } = await context.supabase.from("bolao_matches").insert(rows);
        if (insErr) {
          console.error("[saveBolaoMatches] Erro ao inserir jogos:", insErr);
          return { ok: false, message: "Erro ao vincular jogos: " + insErr.message };
        }
      }

      return { ok: true, message: `${data.match_ids.length} jogos vinculados!` };
    } catch (e: any) {
      console.error("[saveBolaoMatches] Erro:", e?.message);
      return { ok: false, message: e?.message ?? "Erro interno ao salvar jogos." };
    }
  });

/**
 * Save consolidado: valida no servidor, garante ownership via RLS,
 * atualiza `boloes` e substitui a lista de `bolao_matches` numa única chamada.
 */
export const saveBolao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => saveBolaoSchema.parse(d))
  .handler(async ({ data, context }): Promise<SaveBolaoResult> => {
    try {
      // Verifica se slug já pertence a outro bolão.
      const { data: dup } = await context.supabase
        .from("boloes")
        .select("id")
        .eq("slug", data.slug)
        .neq("id", data.bolao_id)
        .maybeSingle();
      if (dup) return { ok: false, message: "Este link (slug) já está em uso. Escolha outro." };

      const { error: updErr } = await context.supabase
        .from("boloes")
        .update({
          nome: data.nome,
          slug: data.slug,
          descricao: data.descricao ?? null,
          regras: data.regras ?? null,
          valor_palpite: data.valor_palpite,
          percentual_admin: data.percentual_admin,
          permitir_ranking_publico: data.permitir_ranking_publico,
          permitir_ganhadores_publico: data.permitir_ganhadores_publico,
          data_limite_palpite: data.data_limite_palpite ?? null,
        })
        .eq("id", data.bolao_id);
      if (updErr) return { ok: false, message: "Erro ao atualizar bolão: " + updErr.message };

      const { error: delErr } = await context.supabase
        .from("bolao_matches")
        .delete()
        .eq("bolao_id", data.bolao_id);
      if (delErr) return { ok: false, message: "Erro ao limpar jogos: " + delErr.message };

      if (data.match_ids.length > 0) {
        const rows = data.match_ids.map((mid) => ({ bolao_id: data.bolao_id, match_id: mid }));
        const { error: insErr } = await context.supabase.from("bolao_matches").insert(rows);
        if (insErr) return { ok: false, message: "Erro ao vincular jogos: " + insErr.message };
      }

      return { ok: true, message: "Bolão salvo com sucesso!" };
    } catch (e: any) {
      console.error("[saveBolao] Erro:", e?.message);
      return { ok: false, message: e?.message ?? "Erro interno ao salvar bolão." };
    }
  });

export type WAConfigOutput = Record<string, any> | null;

export const getWaConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WAConfigOutput> => {
    const { data: tenantId, error: tenantErr } = await context.supabase.rpc("current_tenant_id");
    if (tenantErr || !tenantId) return null;
    const { data } = await context.supabase
      .from("tenant_whatsapp_config")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    return data ?? null;
  });

export const saveWaConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      data,
      context,
    }): Promise<{ ok: true; message: string } | { ok: false; message: string }> => {
      try {
        const parsed = waConfigSchema.safeParse(data);
        if (!parsed.success) {
          return { ok: false, message: "Número inválido" };
        }
        const d = parsed.data;

        const { data: tenantId, error: tenantErr } =
          await context.supabase.rpc("current_tenant_id");
        if (tenantErr || !tenantId) {
          return { ok: false, message: "Erro ao buscar dados do organizador." };
        }

        const { error } = await context.supabase.rpc("upsert_whatsapp_config", {
          p_tenant_id: tenantId,
          p_numero_whatsapp: d.numero_whatsapp,
          p_mensagem_novo_palpite: d.mensagem_novo_palpite ?? undefined,
          p_mensagem_confirmacao_pagamento: d.mensagem_confirmacao_pagamento ?? undefined,
          p_mensagem_ganhador: d.mensagem_ganhador ?? undefined,
          p_mensagem_lembrete_pagamento: d.mensagem_lembrete_pagamento ?? undefined,
        });

        if (error) return { ok: false, message: "Erro ao salvar: " + error.message };
        return { ok: true, message: "Salvo!" };
      } catch (e: any) {
        return { ok: false, message: e?.message || "Erro interno" };
      }
    },
  );