import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Assina mudanças em tempo real nas tabelas de partidas e invalida
 * as queries relacionadas para que as telas se atualizem sozinhas
 * conforme a API sincroniza novos resultados/eventos.
 */
export function useRealtimeMatches() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("matches-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, (payload) => {
        qc.invalidateQueries({ queryKey: ["matches"] });
        qc.invalidateQueries({ queryKey: ["dashboard"] });
        qc.invalidateQueries({ queryKey: ["groups"] });
        const id = (payload.new as { id?: string } | null)?.id ?? (payload.old as { id?: string } | null)?.id;
        if (id) qc.invalidateQueries({ queryKey: ["match", id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "match_events" }, (payload) => {
        const id = (payload.new as { match_id?: string } | null)?.match_id ?? (payload.old as { match_id?: string } | null)?.match_id;
        if (id) qc.invalidateQueries({ queryKey: ["match", id] });
        qc.invalidateQueries({ queryKey: ["dashboard"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "match_statistics" }, (payload) => {
        const id = (payload.new as { match_id?: string } | null)?.match_id ?? (payload.old as { match_id?: string } | null)?.match_id;
        if (id) qc.invalidateQueries({ queryKey: ["match", id] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
