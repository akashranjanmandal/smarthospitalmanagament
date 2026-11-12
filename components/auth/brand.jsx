import { Activity } from "lucide-react";

const HOSPITAL_NAME = process.env.NEXT_PUBLIC_HOSPITAL_NAME || "Smart Hospital";

/** Compact brand mark shown above the form on phones. */
export function Brand({ className = "" }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-white">
        <Activity className="size-5" />
      </div>
      <div className="leading-tight">
        <div className="text-[15px] font-bold tracking-tight">{HOSPITAL_NAME}</div>
        <div className="text-[11px] font-medium text-muted-foreground">Hospital Management System</div>
      </div>
    </div>
  );
}
