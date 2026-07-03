// Estratégia única de sincronização: worldcup26.ir como fonte primária,
// football-data.org apenas como fallback quando a primária falhar.
// Executar UMA API por vez evita linhas duplicadas em `matches`
// (kickoff_at difere entre as fontes → colidiria com o UPSERT
// (home_team_id, away_team_id, kickoff_at)).

export type UnifiedSyncResult = {
  ok: boolean;
  status: "success" | "error" | "skipped";
  message: string;
  source: "worldcup26.ir" | "football-data.org";
  fallback?: boolean;
  primaryError?: string;
  summary?: Record<string, number>;
};

export async function syncMatchesUnified(triggeredBy: string): Promise<UnifiedSyncResult> {
  try {
    const { syncWorldCup2026 } = await import("@/lib/worldcup26-sync.server");
    const res = await syncWorldCup2026(triggeredBy);
    if (res.ok) {
      return { ...res, source: "worldcup26.ir" };
    }
    throw new Error(res.message);
  } catch (primaryErr) {
    const primaryMsg = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
    console.warn("[sync] worldcup26.ir falhou, usando football-data.org:", primaryMsg);
    const { syncFootballData } = await import("@/lib/football-sync.server");
    const res = await syncFootballData(triggeredBy);
    return {
      ...res,
      source: "football-data.org",
      fallback: true,
      primaryError: primaryMsg,
    };
  }
}
