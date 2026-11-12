import { cn } from "@/lib/utils";

/**
 * Quiet loading state: a thin line moving across the top of the screen and a faint outline
 * of a page, so content appears where the eye already is. (`messages` and `size` are accepted
 * for older callers and ignored.)
 */
export function PageLoader({ className }) {
  return (
    <div role="status" aria-label="Loading" className={cn("space-y-6", className)}>
      <div className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-primary/10" style={{ top: "env(safe-area-inset-top, 0px)" }}>
        <div className="progress-sweep h-full w-1/3 rounded-full bg-primary" />
      </div>
      <div className="space-y-2.5">
        <div className="h-7 w-56 max-w-[70%] rounded-md bg-muted" />
        <div className="h-4 w-96 max-w-[90%] rounded-md bg-muted/70" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-xl bg-muted/60" />)}
      </div>
      <div className="space-y-2 rounded-xl border border-border/60 p-4">
        {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-4 rounded bg-muted/60" style={{ width: `${92 - i * 9}%` }} />)}
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}
