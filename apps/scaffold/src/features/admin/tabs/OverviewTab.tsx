import { getBlocksManifest } from "@/lib/blocks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function OverviewTab() {
  const manifest = getBlocksManifest();
  const enabledCount = Object.values(manifest.blocks).filter((b) => b.state === "enabled").length;
  const stubCount = Object.values(manifest.blocks).filter((b) => b.state === "stub").length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Enabled blocks</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{enabledCount}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Stub blocks</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{stubCount}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Status</CardTitle>
          </CardHeader>
          <CardContent className="text-lg">Healthy</CardContent>
        </Card>
      </div>
      <p className="text-muted-foreground">
        Enable blocks via <code className="rounded bg-muted px-1">pnpm blocks:activate &lt;block&gt;</code> to see
        additional metric tabs.
      </p>
    </div>
  );
}
