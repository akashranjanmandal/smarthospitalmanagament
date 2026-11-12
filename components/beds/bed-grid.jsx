"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BED_TYPE_LABELS, BED_STATUS_LABELS, GENDER_WARD_LABELS } from "@/lib/constants";
import { BedDouble, User, Sparkles, ShieldCheck, AlertTriangle } from "lucide-react";

const statusStyles = {
  VACANT: {
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    border: "border-emerald-200 dark:border-emerald-800/60",
    hoverBorder: "hover:border-emerald-400 dark:hover:border-emerald-600",
    text: "text-emerald-700 dark:text-emerald-400",
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300",
    ring: "ring-emerald-500/20",
    icon: <BedDouble className="h-5 w-5" />,
    pulseColor: "bg-emerald-500",
  },
  OCCUPIED: {
    bg: "bg-rose-50 dark:bg-rose-950/40",
    border: "border-rose-200 dark:border-rose-800/60",
    hoverBorder: "hover:border-rose-400 dark:hover:border-rose-600",
    text: "text-rose-700 dark:text-rose-400",
    badge: "bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300",
    ring: "ring-rose-500/20",
    icon: <User className="h-5 w-5" />,
    pulseColor: "bg-rose-500",
  },
  RESERVED: {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-200 dark:border-amber-800/60",
    hoverBorder: "hover:border-amber-400 dark:hover:border-amber-600",
    text: "text-amber-700 dark:text-amber-400",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300",
    ring: "ring-amber-500/20",
    icon: <ShieldCheck className="h-5 w-5" />,
    pulseColor: "bg-amber-500",
  },
  NEEDS_CLEANING: {
    bg: "bg-violet-50 dark:bg-violet-950/40",
    border: "border-violet-200 dark:border-violet-800/60",
    hoverBorder: "hover:border-violet-400 dark:hover:border-violet-600",
    text: "text-violet-700 dark:text-violet-400",
    badge: "bg-violet-100 text-violet-800 dark:bg-violet-900/60 dark:text-violet-300",
    ring: "ring-violet-500/20",
    icon: <Sparkles className="h-5 w-5" />,
    pulseColor: "bg-violet-500",
  },
};

const genderWardStyles = {
  MALE: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
  FEMALE: "bg-pink-100 text-pink-800 dark:bg-pink-900/50 dark:text-pink-300",
  MIXED: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

function BedCard({ bed, onClick }) {
  const style = statusStyles[bed.status];
  const isClickable = !!onClick;
  const timeAgo = getTimeAgo(bed.statusUpdatedAt);

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onClick?.(bed)}
            disabled={!isClickable}
            className={`
              group relative w-full text-left rounded-xl border-2 p-3 transition-all duration-200
              ${style.bg} ${style.border}
              ${isClickable ? `${style.hoverBorder} hover:shadow-md hover:-translate-y-0.5 cursor-pointer active:scale-[0.98]` : "cursor-default"}
              focus-visible:outline-none focus-visible:ring-2 ${style.ring}
            `}
            id={`bed-${bed.bedNumber}`}
          >
            {/* Status indicator dot */}
            <div className="absolute top-2 right-2">
              <div className="relative flex h-2.5 w-2.5">
                {bed.status === "NEEDS_CLEANING" && (
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${style.pulseColor} opacity-75`}></span>
                )}
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${style.pulseColor}`}></span>
              </div>
            </div>

            {/* Bed Number + Icon */}
            <div className="flex items-center gap-2 mb-1.5 pr-3 min-w-0">
              <div className={`${style.text} shrink-0`}>
                {style.icon}
              </div>
              <span className="font-bold text-sm text-foreground whitespace-nowrap truncate">{bed.bedNumber}</span>
            </div>

            {/* Status Badge */}
            <div className={`mt-2 flex items-center justify-center w-full px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-tight ${style.badge}`}>
              {BED_STATUS_LABELS[bed.status]}
            </div>

            {/* Patient info for occupied beds */}
            {bed.status === "OCCUPIED" && bed.patient && (
              <p className="mt-1.5 text-xs text-muted-foreground truncate">
                {bed.patient.firstName} {bed.patient.lastName}
              </p>
            )}
            {bed.status === "OCCUPIED" && bed.doctor && (
              <p className="text-[11px] text-muted-foreground/80 truncate">
                Dr. {bed.doctor.user.firstName} {bed.doctor.user.lastName}
              </p>
            )}

            {/* Needs cleaning alert */}
            {bed.status === "NEEDS_CLEANING" && (
              <div className="mt-1.5 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-violet-500 animate-pulse" />
                <span className="text-xs text-violet-600 dark:text-violet-400 font-medium">Housekeeping</span>
              </div>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[200px]">
          <div className="space-y-1 text-xs">
            <p className="font-semibold">Bed {bed.bedNumber}</p>
            <p>Type: {BED_TYPE_LABELS[bed.bedType]}</p>
            <p>Status: {BED_STATUS_LABELS[bed.status]}</p>
            {bed.patient && (
              <p>Patient: {bed.patient.firstName} {bed.patient.lastName}</p>
            )}
            {bed.doctor && (
              <p>Doctor: Dr. {bed.doctor.user.firstName} {bed.doctor.user.lastName}</p>
            )}
            {bed.department && <p>Department: {bed.department.name}</p>}
            {bed.notes && <p className="text-muted-foreground italic">{bed.notes}</p>}
            <p className="text-muted-foreground">{timeAgo}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function getTimeAgo(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

export function BedGrid({ wards, onBedClick }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {wards.map((ward) => (
        <Card
          key={ward.id}
          className="border shadow-soft overflow-hidden transition-all duration-300 hover:shadow-hover"
          id={`ward-${ward.id}`}
        >
          <CardHeader className="pb-3 space-y-1">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">{ward.name}</CardTitle>
              <Badge variant="outline" className={`text-xs ${genderWardStyles[ward.genderWard]}`}>
                {GENDER_WARD_LABELS[ward.genderWard]}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{ward.department.name}</span>
              <span>•</span>
              <span>{ward.beds.length} beds</span>
              <span>•</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                {ward.beds.filter((b) => b.status === "VACANT").length} available
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-2">
              {ward.beds.map((bed) => (
                <BedCard
                  key={bed.id}
                  bed={bed}
                  onClick={onBedClick ? () => onBedClick(bed, ward) : undefined}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
