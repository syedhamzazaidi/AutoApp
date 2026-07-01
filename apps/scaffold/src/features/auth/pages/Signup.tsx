import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isBlockEnabled } from "@/lib/blocks";
import { isSupabaseReady, supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const authEnabled = isBlockEnabled("auth");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!authEnabled || !isSupabaseReady()) return;
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    setLoading(false);
    if (error) {
      toast({ title: "Signup failed", description: error.message });
      return;
    }
    toast({ title: "Account created", description: "You can now sign in." });
    navigate("/login");
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create account</CardTitle>
        </CardHeader>
        <CardContent>
          {!authEnabled && (
            <p className="mb-4 rounded-md bg-muted p-3 text-sm">Auth not configured — enable the auth block.</p>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input placeholder="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
            <Button type="submit" className="w-full" disabled={!authEnabled || loading}>
              {loading ? "Creating..." : "Sign up"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account? <Link to="/login" className="text-primary underline">Sign in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
