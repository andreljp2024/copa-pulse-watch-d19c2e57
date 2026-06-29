import { useEffect } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Assina mudanças em tempo real e invalida queries com debouncing
 * para evitar refetch em rajada quando vários eventos chegam juntos.
 */
export function useRealtimeMatches() {
  const qc = useQueryClient();

  useEffect(() => {
    const pending = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const flush = () => {
      timer = null;
      const keys = [...pending].map((k) => JSON.parse(k) as QueryKey);
      pending.clear();
      for (const key of keys) qc.invalidateQueries({ queryKey: key });
    };

    const schedule = (key: QueryKey) => {
      pending.add(JSON.stringify(key));
      if (timer == null) timer = setTimeout(flush, 400);
    };

    const channel = supabase
      .channel("matches-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, (payload) => {
        schedule(["matches"]);
        schedule(["dashboard"]);
        schedule(["groups"]);
        schedule(["bolao"]);
        const id =
          (payload.new as { id?: string } | null)?.id ??
          (payload.old as { id?: string } | null)?.id;
        if (id) schedule(["match", id]);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "palpites" }, () => {
        schedule(["bolao"]);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "torcedores" }, () => {
        schedule(["bolao"]);
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match_events" },
        (payload) => {
          const id =
            (payload.new as { match_id?: string } | null)?.match_id ??
            (payload.old as { match_id?: string } | null)?.match_id;
          if (id) schedule(["match", id]);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match_statistics" },
        (payload) => {
          const id =
            (payload.new as { match_id?: string } | null)?.match_id ??
            (payload.old as { match_id?: string } | null)?.match_id;
          if (id) schedule(["match", id]);
        },
      )
      .subscribe();

    return () => {
      if (timer != null) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
