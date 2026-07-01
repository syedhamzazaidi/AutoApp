import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { isBlockEnabled } from "@/lib/blocks";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  if (!isBlockEnabled("auth")) {
    return <>{children}</>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireAdmin) {
    // Admin check delegated to rbac hook in admin routes
    return <>{children}</>;
  }

  return <>{children}</>;
}
