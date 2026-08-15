// Estratégia única de sincronização (futebol de clubes brasileiros).
// Fonte primária: football-data.org (competição padrão BSA — Brasileirão Série A).
// A arquitetura mantém um slot de contingência para uma segunda fonte
// (ex.: API-Football/API-Sports) sem alterar os consumidores.
// Executar UMA API por vez evita linhas duplicadas em `matches`
// (kickoff_at difere entre as fontes → colidiria com o UPSERT
// (home_team_id, away_team_id, kickoff_at)).

export type SyncSource = "football-data.org" | "api-football";

export type UnifiedSyncResult = {
  ok: boolean;
  status: "success" | "error" | "skipped";
  message: string;
  source: SyncSource;
  fallback?: boolean;
  primaryError?: string;
  summary?: Record<string, number>;
};

export async function syncMatchesUnified(triggeredBy: string): Promise<UnifiedSyncResult> {
  try {
    const { syncFootballData } = await import("@/lib/football-sync.server");
    const res = await syncFootballData(triggeredBy);
    return { ...res, source: "football-data.org" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[sync] football-data.org falhou:", message);
    return {
      ok: false,
      status: "error",
      message: `Falha na sincronização: ${message}`,
      source: "football-data.org",
      primaryError: message,
    };
  }
}
