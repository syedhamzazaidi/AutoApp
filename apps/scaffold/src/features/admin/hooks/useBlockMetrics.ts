import { useEffect, useState } from "react";
import { isSupabaseReady, supabase } from "@/integrations/supabase/client";

export function useBlockMetrics(endpoint: string) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseReady()) {
      setLoading(false);
      return;
    }

    supabase.functions
      .invoke("admin-metrics", { body: { route: endpoint } })
      .then(({ data, error: fnError }) => {
        if (fnError) {
          setError(fnError.message);
        } else {
          setData(data as Record<string, unknown>);
        }
        setLoading(false);
      });
  }, [endpoint]);

  return { data, loading, error };
}
