import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth";
import { useToast } from "@/components/ui/use-toast";
import { analyzePlant, uploadPlantImage } from "@/services/plantService";

export default function AnalyzePage() {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [plantName, setPlantName] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<{ analysis: string; healthScore: number } | null>(null);

  if (loading) return <div className="p-8">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;

  async function handleAnalyze() {
    if (!file || !user) return;
    setAnalyzing(true);
    try {
      const imagePath = await uploadPlantImage(file, user.id);
      const analysis = await analyzePlant(imagePath, user.id, plantName || undefined);
      setResult({ analysis: analysis.analysis ?? "No analysis", healthScore: analysis.healthScore ?? 0 });
      toast({ title: "Analysis complete", description: "Your plant has been analyzed." });
    } catch (err) {
      toast({ title: "Analysis failed", description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="container mx-auto max-w-lg p-8">
      <Card>
        <CardHeader>
          <CardTitle>Analyze your plant</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="Plant name (optional)" value={plantName} onChange={(e) => setPlantName(e.target.value)} />
          <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <Button onClick={handleAnalyze} disabled={!file || analyzing} className="w-full">
            {analyzing ? "Analyzing..." : "Analyze"}
          </Button>
          {result && (
            <div className="rounded-md bg-muted p-4">
              <p className="font-medium">Health score: {result.healthScore}/100</p>
              <p className="mt-2 text-sm">{result.analysis}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
