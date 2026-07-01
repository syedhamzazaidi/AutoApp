import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Leaf } from "lucide-react";
import { isBlockEnabled } from "@/lib/blocks";
import { useAuth } from "@/features/auth";
import { useRole } from "@/features/admin/rbac/useRole";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const showAdmin = isBlockEnabled("rbac") && isAdmin;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <Leaf className="h-5 w-5 text-primary" />
            Plant Pal
          </Link>
          <nav className="flex items-center gap-4">
            <Link to="/analyze" className="text-sm hover:text-primary">
              Analyze
            </Link>
            <Link to="/history" className="text-sm hover:text-primary">
              History
            </Link>
            {showAdmin && (
              <Link to="/admin" className="text-sm hover:text-primary">
                Admin
              </Link>
            )}
            {user ? (
              <span className="text-sm text-muted-foreground">{user.email}</span>
            ) : isBlockEnabled("auth") ? (
              <Button asChild size="sm" variant="outline">
                <Link to="/login">Sign in</Link>
              </Button>
            ) : null}
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
