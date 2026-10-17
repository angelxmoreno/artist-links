import { Loader2 } from "lucide-react";

export function ResultSkeleton({ label }: { label: string }) {
  return (
    <div>
      <p className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Loader2 className="size-4 animate-spin" />
        {label}
      </p>
      <div className="h-8 w-1/2 rounded-md bg-muted animate-pulse" />
      <div className="mt-2 h-4 w-1/3 rounded-md bg-muted animate-pulse" />
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    </div>
  );
}
