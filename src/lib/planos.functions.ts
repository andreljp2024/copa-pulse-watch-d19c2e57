import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const listPlanos = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await supabase
    .from("planos")
    .select(
      "id, nome, preco, limite_palpites, limite_boloes, limite_torcedores, permite_logo, permite_exportacao, permite_whatsapp_api, permite_dominio_personalizado",
    )
    .eq("ativo", true)
    .order("preco", { ascending: true });
  if (error) throw error;
  return data;
});
