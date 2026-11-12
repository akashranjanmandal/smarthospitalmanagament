"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { checkInAppointment, callNextPatient } from "@/actions/queue";
import { completeAppointment } from "@/actions/appointments";
import { Panel, Chip } from "@/components/inpatient/ui";
import { Button, buttonVariants } from "@/components/ui/button";
import { ageSex, fmtDate, fmtTime, fullName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CheckCircle2, Megaphone, MonitorPlay, UserCheck } from "lucide-react";

const minutesSince = (d, now) => Math.max(0, Math.round((now - new Date(d).getTime()) / 60000));

export function QueueBoard({ data, role, canAct, canComplete }) {
  const router = useRouter();
  const [busy, setBusy] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const isDoctor = role === "DOCTOR";

  // Keep the board live: new check-ins and calls from other desks appear without reloading.
  useEffect(() => {
    const t = setInterval(() => {
      setNow(Date.now());
      router.refresh();
    }, 15000);
    return () => clearInterval(t);
  }, [router]);

  const run = async (key, fn) => {
    setBusy(key);
    const res = await fn();
    setBusy(null);
    if (!res.success) return toast.error(res.message);
    toast.success(res.message);
    router.refresh();
  };

  const totals = data.doctors.reduce((t, d) => ({ waiting: t.waiting + d.waiting.length, notArrived: t.notArrived + d.notArrived.length, seen: t.seen + d.seen }), { waiting: 0, notArrived: 0, seen: 0 });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{isDoctor ? "My OPD Queue" : "OPD Queue"}</h1>
          <p className="text-sm text-muted-foreground">
            {data.date ? fmtDate(data.date) : "Today"} · {totals.waiting} waiting · {totals.notArrived} not arrived · {totals.seen} seen
          </p>
        </div>
        <Link href="/queue-display" target="_blank" className={cn(buttonVariants({ variant: "outline" }), "gap-2 rounded-lg")}>
          <MonitorPlay className="size-4" /> Waiting-room display
        </Link>
      </div>

      {data.doctors.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">No OPD appointments today.</div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {data.doctors.map((d) => (
            <Panel
              key={d.doctorId}
              title={<span>{d.doctor} <span className="font-normal text-muted-foreground">· {d.department}</span></span>}
              action={<span className="text-xs text-muted-foreground">{d.seen} seen</span>}
              bodyClassName="space-y-4"
            >
              {/* Now serving */}
              <div className={cn("flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3", d.nowServing ? "border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/30" : "border-dashed")}>
                {d.nowServing ? (
                  <div className="flex items-center gap-3">
                    <span className="flex size-12 items-center justify-center rounded-lg bg-sky-600 text-xl font-bold text-white tabular-nums">{d.nowServing.tokenNumber}</span>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-sky-800 dark:text-sky-300">In consultation</div>
                      <div className="font-semibold">{fullName(d.nowServing.patient)}</div>
                      <div className="text-xs text-muted-foreground tabular-nums">{d.nowServing.patient.uhid} · {ageSex(d.nowServing.patient)} · since {fmtTime(d.nowServing.consultStartedAt)}</div>
                    </div>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">No one in consultation</span>
                )}
                <div className="flex gap-2">
                  {d.nowServing && canComplete && (
                    <Button size="sm" variant="outline" className="gap-1.5 rounded-lg" disabled={busy !== null} onClick={() => run(`done-${d.doctorId}`, () => completeAppointment(d.nowServing.id))}>
                      <CheckCircle2 className="size-4" /> Done
                    </Button>
                  )}
                  {canAct && !d.nowServing && (
                    <Button size="sm" className="gap-1.5 rounded-lg" disabled={busy !== null || d.waiting.length === 0} onClick={() => run(`call-${d.doctorId}`, () => callNextPatient({ doctorId: d.doctorId }))}>
                      <Megaphone className="size-4" /> Call next
                    </Button>
                  )}
                </div>
              </div>

              {/* Waiting */}
              <div>
                <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Waiting ({d.waiting.length})</h3>
                {d.waiting.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nobody is waiting.</p>
                ) : (
                  <ul className="divide-y divide-border/60 rounded-lg border">
                    {d.waiting.map((w) => {
                      const waited = minutesSince(w.checkedInAt, now);
                      return (
                        <li key={w.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                          <span className="w-8 text-center font-bold tabular-nums">{w.tokenNumber}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{fullName(w.patient)}</span>
                            <span className="block truncate text-xs text-muted-foreground">{w.patient.uhid} · booked {w.appointmentTime}{w.reason ? ` · ${w.reason}` : ""}</span>
                          </span>
                          <Chip tone={waited >= 45 ? "bad" : waited >= 20 ? "warn" : "neutral"}>{waited} min</Chip>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* Not arrived */}
              {d.notArrived.length > 0 && (
                <div>
                  <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Not arrived ({d.notArrived.length})</h3>
                  <ul className="divide-y divide-border/60 rounded-lg border">
                    {d.notArrived.map((n) => (
                      <li key={n.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                        <span className="w-12 text-xs font-medium tabular-nums text-muted-foreground">{n.appointmentTime}</span>
                        <span className="min-w-0 flex-1 truncate">{fullName(n.patient)} <span className="text-xs text-muted-foreground">· {n.patient.uhid}</span></span>
                        {canAct && !isDoctor && (
                          <Button size="sm" variant="outline" className="h-8 gap-1.5 rounded-lg" disabled={busy !== null} onClick={() => run(`in-${n.id}`, () => checkInAppointment(n.id))}>
                            <UserCheck className="size-4" /> Check in
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
