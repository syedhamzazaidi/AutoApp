export function TabPlaceholder({ blockName }: { blockName: string }) {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
      Enable the <strong>{blockName}</strong> block to see metrics here.
    </div>
  );
}
