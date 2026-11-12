"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { markDelivered, deliverStandardMeal } from "@/actions/meals";
import { Chip, Panel } from "@/components/inpatient/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MEALS, DIET_LABELS } from "@/lib/diet/meals";
import { fmtDate, fmtTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AlertTriangle, Printer } from "lucide-react";

const DIET_TONE = { NORMAL: "neutral", NIL_BY_MOUTH: "bad", DIABETIC: "warn", LOW_SALT: "warn", RENAL: "warn" };
const SERVERS = ["WARD_ATTENDANT", "KITCHEN", "NURSE", "ADMIN", "SUPER_ADMIN"];

export function KitchenBoard({ data, role }) {
  const router = useRouter();
  const params = useSearchParams();
  const [busy, setBusy] = useState(null);
  if (!data) return <p className="text-sm text-muted-foreground">Could not load the meal list.</p>;

  const go = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => next.set(k, v));
    router.push(`/kitchen?${next}`);
  };
  const deliver = async (row) => {
    setBusy(row.admissionId);
    const res = row.orderId ? await markDelivered(row.orderId) : await deliverStandardMeal(row.admissionId, { date: data.date, meal: data.meal });
    setBusy(null);
    if (!res.success) return toast.error(res.message);
    toast.success(`${row.bedNumber}: ${res.message}`);
    router.refresh();
  };
  const wards = [...new Set(data.rows.map((r) => r.ward))];
  const served = data.rows.filter((r) => r.status === "DELIVERED").length;
  const toServe = data.rows.filter((r) => !r.nilByMouth).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{role === "KITCHEN" || role === "ADMIN" || role === "SUPER_ADMIN" ? "Kitchen" : "Ward Meals"} · {data.label}</h1>
          <p className="text-sm text-muted-foreground">
            {fmtDate(data.date)} · served {data.serve} · {data.open ? `patients can still choose until ${fmtTime(data.cutoff)}` : "choices closed"} · {served} of {toServe} delivered
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Input type="date" value={data.date} onChange={(e) => e.target.value && go({ date: e.target.value })} className="h-9 w-40 rounded-lg" aria-label="Date" />
          <div className="flex gap-1 rounded-lg bg-muted p-1 text-sm" role="tablist" aria-label="Meal">
            {MEALS.map((m) => (
              <button key={m.key} type="button" role="tab" aria-selected={data.meal === m.key} onClick={() => go({ meal: m.key })} className={cn("rounded-md px-2.5 py-1", data.meal === m.key ? "bg-card font-semibold shadow-sm" : "text-muted-foreground")}>{m.label}</button>
            ))}
          </div>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-lg" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
          {(role === "KITCHEN" || role === "ADMIN" || role === "SUPER_ADMIN") && <Link href="/kitchen/menu" className="text-sm font-medium text-primary hover:underline">Edit menu</Link>}
        </div>
      </div>

      <Panel title="Prepare">
        {data.prep.length === 0 ? <p className="text-sm text-muted-foreground">Nothing to prepare.</p> : (
          <ul className="flex flex-wrap gap-2">
            {data.prep.map((p) => <li key={p.name} className="rounded-lg border px-3 py-1.5 text-sm"><span className="font-bold tabular-nums">{p.quantity}</span> × {p.name}</li>)}
          </ul>
        )}
      </Panel>

      {wards.length === 0 && <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No patients are admitted.</div>}
      {wards.map((ward) => (
        <Panel key={ward} title={ward} bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <tr><th className="px-3 py-2">Bed</th><th className="px-3 py-2">Patient</th><th className="px-3 py-2">Diet</th><th className="px-3 py-2">Serve</th><th className="px-3 py-2">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {data.rows.filter((r) => r.ward === ward).map((r) => (
                  <tr key={r.admissionId} className={cn(r.nilByMouth && "bg-rose-50/60 dark:bg-rose-950/20")}>
                    <td className="px-3 py-2 font-bold">{r.bedNumber}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{r.patientName}</div>
                      {r.allergies && <div className="flex items-center gap-1 text-xs font-semibold text-rose-700 dark:text-rose-300"><AlertTriangle className="size-3" /> {r.allergies}</div>}
                    </td>
                    <td className="px-3 py-2"><Chip tone={DIET_TONE[r.dietType] ?? "info"}>{DIET_LABELS[r.dietType]}</Chip>{r.dietNotes && <div className="mt-0.5 text-xs text-muted-foreground">{r.dietNotes}</div>}</td>
                    <td className="px-3 py-2">
                      <div className={cn(r.nilByMouth && "font-semibold text-rose-700 dark:text-rose-300", !r.orderId && !r.nilByMouth && "text-muted-foreground")}>{r.serve}</div>
                      {r.notes && <div className="text-xs">Note: {r.notes}</div>}
                    </td>
                    <td className="px-3 py-2">
                      {r.nilByMouth ? <Chip tone="bad">Do not serve</Chip> : r.status === "DELIVERED" ? (
                        <Chip tone="good">Delivered {fmtTime(r.deliveredAt)}</Chip>
                      ) : SERVERS.includes(role) ? (
                        <Button size="sm" variant="outline" className="h-8 rounded-md print:hidden" disabled={busy !== null} onClick={() => deliver(r)}>Delivered</Button>
                      ) : <Chip>To serve</Chip>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ))}
    </div>
  );
}
