import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Sincroniza jogos/seleções da API externa usando uma única estratégia
 * (worldcup26.ir primária, football-data.org fallback). Executar apenas
 * uma API por vez evita duplicidade de linhas em `matches`, já que cada
 * fonte gera `kickoff_at` com timezones diferentes.
 */
export const syncMatchesForTenant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: tenant } = await context.supabase
      .from("tenants")
      .select("id")
      .eq("owner_user_id", context.userId)
      .maybeSingle();
    if (!tenant) throw new Error("Tenant não encontrado — cadastre-se como organizador.");

    const { syncMatchesUnified } = await import("@/lib/sync-with-fallback.server");
    return syncMatchesUnified(`tenant:${context.userId}`);
  });
