export function Notice({ children, tone }: { children: React.ReactNode; tone?: "error" }) {
  return (
    <div
      className={`rounded-xl border p-4 text-sm ${tone === "error" ? "border-destructive/40 text-destructive" : "border-border text-muted-foreground"}`}
    >
      {children}
    </div>
  );
}
