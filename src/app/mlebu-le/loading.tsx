export default function Loading() {
  return (
    <main className="relative min-h-screen flex flex-col overflow-hidden bg-dot-grid">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
          memuat admin gateway...
        </div>
      </div>
    </main>
  );
}