import type { FilePatch } from "@app/shared";

export function generateFeaturePatches(prompt: string): FilePatch[] {
  const normalized = prompt.toLowerCase();

  if (normalized.includes("plant") || normalized.includes("plants page")) {
    return [
      {
        path: "src/pages/PlantsPage.tsx",
        action: "create",
        content: PLANTS_PAGE,
      },
      {
        path: "src/services/plantListService.ts",
        action: "create",
        content: PLANT_LIST_SERVICE,
      },
    ];
  }

  return [
    {
      path: "src/pages/GeneratedPage.tsx",
      action: "create",
      content: GENERIC_PAGE(prompt),
    },
  ];
}

const PLANTS_PAGE = `import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth";
import { Navigate } from "react-router-dom";
import { getPlants } from "@/services/plantListService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Plant {
  id: string;
  name: string;
  species: string;
}

export default function PlantsPage() {
  const { user, loading } = useAuth();
  const [plants, setPlants] = useState<Plant[]>([]);

  useEffect(() => {
    if (user) getPlants().then(setPlants);
  }, [user]);

  if (loading) return <div className="p-8">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">My Plants</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {plants.map((plant) => (
          <Card key={plant.id}>
            <CardHeader>
              <CardTitle>{plant.name}</CardTitle>
            </CardHeader>
            <CardContent>{plant.species}</CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
`;

const PLANT_LIST_SERVICE = `import { supabase } from "@/integrations/supabase/client";

export interface Plant {
  id: string;
  name: string;
  species: string;
}

export async function getPlants(): Promise<Plant[]> {
  const { data, error } = await supabase
    .from("plant_checks")
    .select("id, plant_name, analysis")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.plant_name ?? "Unknown",
    species: row.analysis ?? "Unknown species",
  }));
}
`;

function GENERIC_PAGE(prompt: string): string {
  return `export default function GeneratedPage() {
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold">Generated Feature</h1>
      <p className="text-muted-foreground mt-4">${prompt.replace(/"/g, '\\"')}</p>
    </div>
  );
}
`;
}

export const SYSTEM_PROMPT = `You are a code generation agent for Lovable-style apps.

Use these block contracts (imports only, never rewrite implementations):
- useAuth(), AuthProvider, ProtectedRoute from @/features/auth
- supabase from @/integrations/supabase/client
- uploadFile(), getPublicUrl() from @/features/storage/upload
- ProtectedRoute requireAdmin from @/features/admin/rbac

Generate domain code in src/pages, src/services, src/components only.
Never modify protected block internals.`;
