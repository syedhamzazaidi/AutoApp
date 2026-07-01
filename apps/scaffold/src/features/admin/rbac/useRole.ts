import { useEffect, useState } from "react";
import { isBlockEnabled } from "@/lib/blocks";
import { isSupabaseReady, supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth";

export function useRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isBlockEnabled("rbac") || !user || !isSupabaseReady()) {
      setRole(null);
      setLoading(false);
      return;
    }

    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setRole(data?.role ?? null);
        setLoading(false);
      });
  }, [user]);

  return { role, loading, isAdmin: role === "admin" };
}

export function isAdmin(role: string | null): boolean {
  return role === "admin";
}
