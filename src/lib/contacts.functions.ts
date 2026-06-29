import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const importarContatos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => d as { contatos: { nome: string; whatsapp: string }[]; bolao_id: string; tenant_id: string })
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    const userIds = data.contatos.map(() => userId);
    const bolaoIds = data.contatos.map(() => data.bolao_id);
    const tenantIds = data.contatos.map(() => data.tenant_id);

    const { data: inserted, error } = await supabase
      .from("torcedores")
      .upsert(
        data.contatos.map((c) => ({
          tenant_id: data.tenant_id,
          bolao_id: data.bolao_id,
          nome: c.nome.trim(),
          whatsapp: c.whatsapp.replace(/\D/g, ""),
        })),
        { onConflict: "bolao_id,whatsapp", ignoreDuplicates: true },
      )
      .select("id, nome, whatsapp");

    if (error) {
      return { ok: false, error: error.message, imported: 0 };
    }

    return { ok: true, imported: inserted?.length ?? 0, erros: 0 };
  });
