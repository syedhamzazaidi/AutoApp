import { useEffect, useState } from "react";
import { isBlockEnabled } from "@/lib/blocks";
import { isSupabaseReady, supabase } from "@/integrations/supabase/client";

export function useRealtimeTable<T extends Record<string, unknown>>(
  table: string,
  filter?: { column: string; value: string },
) {
  const [rows, setRows] = useState<T[]>([]);

  useEffect(() => {
    if (!isBlockEnabled("realtime") || !isSupabaseReady()) return;

    const channel = supabase
      .channel(`${table}-changes`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: filter ? `${filter.column}=eq.${filter.value}` : undefined },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setRows((prev) => [...prev, payload.new as T]);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, filter?.column, filter?.value]);

  return rows;
}
