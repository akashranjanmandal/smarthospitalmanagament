import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

export function StatCard({ title, value, description, icon: Icon, trend }) {
  return (
    /* hover-zoom + hover-glow applied via global CSS utilities from globals.css.
       No extra import needed — the classes are available everywhere. */
    <Card className="rounded-xl border-border/70 bg-card shadow-none">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground truncate">
              {title}
            </p>
            <p className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground leading-none tabular-nums">
              {value}
            </p>
            {description && (
              <p className="text-xs text-muted-foreground leading-snug">
                {description}
              </p>
            )}
          </div>
          {Icon && (
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-[18px]" />
            </div>
          )}
        </div>
        {trend && (
          <div className="mt-4 pt-3 border-t border-border/40 flex items-center gap-1.5 text-xs sm:text-sm font-bold">
            <span className={cn(
              "px-2 py-0.5 rounded-md",
              trend.positive
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
            )}>
              {trend.positive ? "+" : ""}{trend.value}%
            </span>
            <span className="text-muted-foreground font-medium">from last month</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}