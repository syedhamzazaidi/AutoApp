import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/features/auth";
import { getPlantHistory, type PlantCheck } from "@/services/plantService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HistoryPage() {
  const { user, loading } = useAuth();
  const [history, setHistory] = useState<PlantCheck[]>([]);

  useEffect(() => {
    if (user) getPlantHistory().then(setHistory).catch(console.error);
  }, [user]);

  if (loading) return <div className="p-8">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="container mx-auto p-8">
      <h1 className="mb-6 text-3xl font-bold">Plant History</h1>
      {history.length === 0 ? (
        <p className="text-muted-foreground">No plant checks yet. Analyze your first plant!</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {history.map((check) => (
            <Card key={check.id}>
              <CardHeader>
                <CardTitle>{check.plantName ?? "Unnamed plant"}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {new Date(check.createdAt).toLocaleDateString()} · Score: {check.healthScore ?? "—"}/100
                </p>
                <p className="mt-2 text-sm">{check.analysis}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
