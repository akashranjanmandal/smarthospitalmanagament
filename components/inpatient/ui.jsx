import { cn } from "@/lib/utils";

/** A plain, dense panel for clinical screens. */
export function Panel({ title, action, children, className, bodyClassName }) {
  return (
    <section className={cn("rounded-xl border border-border/70 bg-card", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
          {title && <h2 className="text-sm font-bold tracking-tight text-foreground">{title}</h2>}
          {action}
        </header>
      )}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

const TONES = {
  neutral: "bg-muted text-foreground/80 border-border",
  info: "bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900",
  good: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
  warn: "bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
  bad: "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900",
};

export function Chip({ tone = "neutral", children, className }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[11px] font-semibold leading-none", TONES[tone], className)}>
      {children}
    </span>
  );
}

export function VitalFlags({ flags = [], empty = null }) {
  if (!flags.length) return empty;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {flags.map((f) => (
        <Chip key={f.field} tone={f.level === "low" && f.field !== "spo2" ? "warn" : "bad"}>{f.label}</Chip>
      ))}
    </span>
  );
}

/** Field label + value, used in summary grids. */
export function Field({ label, children, className }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-foreground break-words">{children ?? "—"}</dd>
    </div>
  );
}

/** Compact one-line vitals: "T 101.4°F · P 112 · BP 118/76 · RR 18 · SpO₂ 97%" */
export function VitalsLine({ v }) {
  if (!v) return <span className="text-muted-foreground">No vitals charted</span>;
  const parts = [
    v.temperature != null && `T ${v.temperature}°F`,
    v.pulse != null && `P ${v.pulse}`,
    v.systolic != null && `BP ${v.systolic}/${v.diastolic}`,
    v.respiratoryRate != null && `RR ${v.respiratoryRate}`,
    v.spo2 != null && `SpO₂ ${v.spo2}%`,
    v.bloodSugar != null && `Sugar ${v.bloodSugar}`,
    v.painScore != null && `Pain ${v.painScore}/10`,
  ].filter(Boolean);
  return <span className="tabular-nums">{parts.join(" · ")}</span>;
}
