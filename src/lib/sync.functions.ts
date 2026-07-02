import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Sincroniza jogos/seleções da API externa (worldcup26.ir com fallback
 * football-data.org). Disponível para qualquer organizador autenticado
 * (tenant_admin) — os dados de jogos são globais e servem a todos os bolões.
 */
export const syncMatchesForTenant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Garante que o usuário tem um tenant (é organizador).
    const { data: tenant } = await context.supabase
      .from("tenants")
      .select("id")
      .eq("owner_user_id", context.userId)
      .maybeSingle();
    if (!tenant) throw new Error("Tenant não encontrado — cadastre-se como organizador.");

    try {
      const { syncWorldCup2026 } = await import("@/lib/worldcup26-sync.server");
      const res = await syncWorldCup2026(`tenant:${context.userId}`);
      return { ...res, source: "worldcup26.ir" as const };
    } catch (primaryErr) {
      const primaryMsg = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
      console.warn("[sync] worldcup26.ir falhou, tentando football-data.org:", primaryMsg);
      const { syncFootballData } = await import("@/lib/football-sync.server");
      const res = await syncFootballData(`tenant:${context.userId}`);
      return { ...res, source: "football-data.org" as const, fallback: true, primaryError: primaryMsg };
    }
  });
