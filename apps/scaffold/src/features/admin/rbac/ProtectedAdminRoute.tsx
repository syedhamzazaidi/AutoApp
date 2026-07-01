import { Navigate } from "react-router-dom";
import { useAuth } from "@/features/auth";
import { useRole } from "./useRole";
import { isBlockEnabled } from "@/lib/blocks";

export function ProtectedAdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useRole();

  if (authLoading || roleLoading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  if (!isBlockEnabled("rbac")) {
    return <>{children}</>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg text-muted-foreground">403 — Admin access required</p>
      </div>
    );
  }

  return <>{children}</>;
}

export { useRole, isAdmin } from "./useRole";
