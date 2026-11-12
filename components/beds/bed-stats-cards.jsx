"use client";

import { Card, CardContent } from "@/components/ui/card";

const statConfig = [
  {
    key: "total",
    label: "Total Beds",
    gradient: "from-slate-500 to-slate-700",
    darkGradient: "dark:from-slate-400 dark:to-slate-600",
    bgClass: "bg-slate-50 dark:bg-slate-900/50",
    iconBg: "bg-slate-100 dark:bg-slate-800",
    textClass: "text-slate-700 dark:text-slate-300",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 4v16" /><path d="M2 8h18a2 2 0 0 1 2 2v10" /><path d="M2 17h20" /><path d="M6 8v9" />
      </svg>
    ),
  },
  {
    key: "vacant",
    label: "Vacant",
    gradient: "from-emerald-500 to-emerald-700",
    darkGradient: "dark:from-emerald-400 dark:to-emerald-600",
    bgClass: "bg-emerald-50 dark:bg-emerald-950/30",
    iconBg: "bg-emerald-100 dark:bg-emerald-900/50",
    textClass: "text-emerald-700 dark:text-emerald-400",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    ),
  },
  {
    key: "occupied",
    label: "Occupied",
    gradient: "from-rose-500 to-rose-700",
    darkGradient: "dark:from-rose-400 dark:to-rose-600",
    bgClass: "bg-rose-50 dark:bg-rose-950/30",
    iconBg: "bg-rose-100 dark:bg-rose-900/50",
    textClass: "text-rose-700 dark:text-rose-400",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="5" /><path d="M20 21a8 8 0 0 0-16 0" />
      </svg>
    ),
  },
  {
    key: "reserved",
    label: "Reserved",
    gradient: "from-amber-500 to-amber-700",
    darkGradient: "dark:from-amber-400 dark:to-amber-600",
    bgClass: "bg-amber-50 dark:bg-amber-950/30",
    iconBg: "bg-amber-100 dark:bg-amber-900/50",
    textClass: "text-amber-700 dark:text-amber-400",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    key: "needsCleaning",
    label: "Needs Cleaning",
    gradient: "from-violet-500 to-violet-700",
    darkGradient: "dark:from-violet-400 dark:to-violet-600",
    bgClass: "bg-violet-50 dark:bg-violet-950/30",
    iconBg: "bg-violet-100 dark:bg-violet-900/50",
    textClass: "text-violet-700 dark:text-violet-400",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
        <path d="M5 3v4" /><path d="M19 17v4" /><path d="M3 5h4" /><path d="M17 19h4" />
      </svg>
    ),
  },
];

export function BedStatsCards({ stats }) {
  const total = stats.total || 1;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {statConfig.map((config) => {
        const value = stats[config.key] || 0;
        const percentage = config.key === "total" ? 100 : Math.round((value / total) * 100);

        return (
          <Card
            key={config.key}
            className={`relative overflow-hidden border-0 shadow-soft transition-all duration-300 hover:shadow-hover hover:-translate-y-0.5 ${config.bgClass}`}
            id={`stat-${config.key}`}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {config.label}
                  </p>
                  <div className="flex items-baseline gap-1.5">
                    <p className={`text-2xl font-bold ${config.textClass}`}>
                      {value}
                    </p>
                    {config.key !== "total" && (
                      <span className="text-xs text-muted-foreground">
                        ({percentage}%)
                      </span>
                    )}
                  </div>
                </div>
                <div className={`p-2 rounded-lg ${config.iconBg} ${config.textClass}`}>
                  {config.icon}
                </div>
              </div>
              {/* Progress bar */}
              <div className="mt-3 h-1.5 rounded-full bg-black/5 dark:bg-white/5 overflow-hidden">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${config.gradient} ${config.darkGradient} transition-all duration-1000 ease-out`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
