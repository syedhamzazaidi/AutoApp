import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function IndexPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-bold tracking-tight">Plant Pal</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Upload a photo of your plant and get an AI-powered health analysis.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Button asChild size="lg">
            <Link to="/analyze">Analyze a plant</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/history">View history</Link>
          </Button>
        </div>
      </div>
      <div className="mx-auto mt-16 grid max-w-4xl gap-6 md:grid-cols-3">
        {[
          { title: "Upload", desc: "Snap a photo of your plant" },
          { title: "Analyze", desc: "AI checks health and gives tips" },
          { title: "Track", desc: "View your plant check history" },
        ].map((f) => (
          <Card key={f.title}>
            <CardHeader>
              <CardTitle>{f.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">{f.desc}</CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
