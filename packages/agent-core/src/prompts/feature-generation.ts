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
- Link, Navigate, useNavigate from react-router-dom (Link uses prop "to", never "href")

Generate domain code in src/pages, src/services, src/components only.
Never modify protected block internals.
Every TSX file must include all imports it uses. Do not rely on globals.
If editableFiles in project context already contains a path, use action "update" for that file.`;

/** Planner: produce a structured plan only (no patches, no tool calls). */
export const PLANNER_PROMPT = `You are the planning stage of a Lovable-style app builder.

Given the user request and recent chat, output a JSON object only (no markdown fences) with:
{
  "goal": string,
  "steps": string[],
  "filesToTouch": string[],
  "notes": string
}

Rules:
- Plan only. Do not write file contents or patches.
- Prefer small, incremental steps.
- filesToTouch must be under src/pages/, src/components/, or src/services/ only.
- Never plan edits to protected block internals (auth, admin, supabase client, shared edge functions).
- If the request is unclear, still propose a minimal safe plan and note assumptions in notes.`;

/** ReAct: follow the plan using tools; keep patches small; fix build failures. */
export const REACT_PROMPT = `${SYSTEM_PROMPT}

You are in the ReAct execution stage. Follow the structured plan using tools.

Tools:
- inspect_project: list file tree, manifest, protected paths (no bulk file bodies)
- read_file: read one editable file before updating it
- apply_patches: apply create/update/delete patches, then observe build ok/error
- activate_block: activate a known block (auth, storage, ai, rbac) via recipe
- finish: end the turn with a short user-facing summary

Rules:
- Follow the plan; do not invent unrelated features.
- Read before update when the file may already exist.
- Prefer small patches. One logical change set per apply_patches call.
- If editable path already exists, use action "update" (not "create").
- Never touch protected paths.
- If apply_patches reports buildFailed, diagnose from buildError, fix with another apply_patches, then finish.
- Call finish when done (or when you cannot make progress). Do not leave the loop without finish unless you have nothing left to say.`;
