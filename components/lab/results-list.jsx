"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { collectSample, acknowledgeCritical, orderTests } from "@/actions/lab";
import { Panel, Chip } from "@/components/inpatient/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

export const LAB_STATUS = { ORDERED: "Ordered", COLLECTED: "In the lab", RESULTED: "Awaiting verification", VERIFIED: "Report ready", CANCELLED: "Cancelled" };
const STATUS_TONE = { ORDERED: "neutral", COLLECTED: "info", RESULTED: "info", VERIFIED: "good", CANCELLED: "bad" };
export const FLAG = {
  N: { label: "", tone: "" },
  H: { label: "High", tone: "text-amber-700 dark:text-amber-300 font-semibold" },
  L: { label: "Low", tone: "text-amber-700 dark:text-amber-300 font-semibold" },
  HH: { label: "Critical high", tone: "text-rose-700 dark:text-rose-300 font-bold" },
  LL: { label: "Critical low", tone: "text-rose-700 dark:text-rose-300 font-bold" },
  A: { label: "Abnormal", tone: "text-amber-700 dark:text-amber-300 font-semibold" },
};

function useRun() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const run = async (fn, after) => {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.success) return toast.error(res.message);
    toast.success(res.message);
    after?.(res);
    router.refresh();
  };
  return [busy, run];
}

/** Results with flags. `compact` fits narrow columns (e.g. the lab's verify list). */
export function ResultTable({ results, compact = false }) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full", compact ? "text-xs" : "min-w-[480px] text-sm")}>
        <thead className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr><th className="py-1 pr-3 font-semibold">Test</th><th className="py-1 pr-3 font-semibold">Result</th><th className="py-1 pr-3 font-semibold">Normal range</th><th className="py-1 font-semibold">Flag</th></tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {results.map((r) => (
            <tr key={r.name}>
              <td className="py-1.5 pr-3">{r.name}</td>
              <td className={cn("py-1.5 pr-3 tabular-nums", FLAG[r.flag]?.tone)}>{typeof r.value === "number" ? r.value.toLocaleString("en-IN") : r.value} {r.unit}</td>
              <td className="py-1.5 pr-3 text-muted-foreground tabular-nums">{r.range} {r.range && r.unit}</td>
              <td className={cn("py-1.5", FLAG[r.flag]?.tone)}>{FLAG[r.flag]?.label}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ResultCard({ r, canCollect, canAck }) {
  const [busy, run] = useRun();
  return (
    <li className={cn("space-y-2 rounded-lg border p-3", r.critical && !r.criticalAckAt && "border-rose-300 bg-rose-50/60 dark:border-rose-900 dark:bg-rose-950/20")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold">{r.test.name}</span>
            {r.priority === "URGENT" && <Chip tone="bad">Urgent</Chip>}
            <Chip tone={STATUS_TONE[r.status]}>{LAB_STATUS[r.status]}</Chip>
            {r.critical && <Chip tone="bad"><AlertTriangle className="size-3" /> Critical</Chip>}
            {!r.critical && r.abnormal && <Chip tone="warn">Abnormal</Chip>}
          </div>
          <div className="text-xs text-muted-foreground">
            {r.orderNumber}{r.accessionNumber ? ` · sample ${r.accessionNumber}` : ""} · ordered {fmtDateTime(r.createdAt)} by {r.orderedBy}
            {r.clinicalNotes ? ` · ${r.clinicalNotes}` : ""}
          </div>
        </div>
        <div className="flex gap-2">
          {canCollect && r.status === "ORDERED" && (
            <Button size="sm" variant="outline" className="h-8 rounded-md" disabled={busy} onClick={() => run(() => collectSample(r.id))}>
              {r.test.department === "LAB" ? "Collect sample" : "Mark done"}
            </Button>
          )}
          {canAck && r.critical && !r.criticalAckAt && (
            <Button size="sm" className="h-8 rounded-md bg-rose-700 text-white hover:bg-rose-800" disabled={busy} onClick={() => run(() => acknowledgeCritical(r.id))}>Acknowledge</Button>
          )}
        </div>
      </div>
      {r.results && <ResultTable results={r.results} />}
      {r.reportText && <p className="whitespace-pre-wrap rounded-md bg-muted/40 p-2 text-sm">{r.reportText}</p>}
      {r.status === "VERIFIED" && (
        <p className="text-xs text-muted-foreground">
          Entered by {r.resultedBy} · verified by {r.verifiedBy} {fmtDateTime(r.verifiedAt)}
          {r.criticalAckAt ? ` · critical result acknowledged by ${r.criticalAckBy} ${fmtDateTime(r.criticalAckAt)}` : ""}
        </p>
      )}
    </li>
  );
}

export function ResultsList({ results, canCollect = false, canAck = false, empty = "No tests yet." }) {
  if (!results.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return <ul className="space-y-2">{results.map((r) => <ResultCard key={r.id} r={r} canCollect={canCollect} canAck={canAck} />)}</ul>;
}

/** Doctor's order form: pick tests (grouped lab / radiology), priority and a clinical note. */
export function OrderTestsForm({ target, catalog }) {
  const [picked, setPicked] = useState([]);
  const [priority, setPriority] = useState("ROUTINE");
  const [notes, setNotes] = useState("");
  const [q, setQ] = useState("");
  const [busy, run] = useRun();
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const s = q.trim().toLowerCase();
  const shown = catalog.filter((t) => !s || t.name.toLowerCase().includes(s) || t.code.toLowerCase().includes(s));
  return (
    <Panel title="Order tests">
      <form onSubmit={(e) => { e.preventDefault(); run(() => orderTests(target, { testIds: picked, priority, clinicalNotes: notes }), () => { setPicked([]); setNotes(""); }); }} className="space-y-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a test (e.g. CBC, X-ray)" className="h-9 rounded-lg sm:max-w-xs" aria-label="Find a test" />
        <div className="grid gap-3 md:grid-cols-2">
          {["LAB", "RADIOLOGY"].map((dept) => (
            <fieldset key={dept} className="space-y-1">
              <legend className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{dept === "LAB" ? "Laboratory" : "Radiology / ECG"}</legend>
              {shown.filter((t) => t.department === dept).map((t) => (
                <label key={t.id} className="flex items-center gap-2 rounded-md px-1 py-0.5 text-sm hover:bg-muted/50">
                  <input type="checkbox" checked={picked.includes(t.id)} onChange={() => toggle(t.id)} />
                  <span className="flex-1">{t.name}</span>
                  <span className="text-xs text-muted-foreground">{t.turnaroundHours ? `~${t.turnaroundHours} h` : ""}</span>
                </label>
              ))}
            </fieldset>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex gap-1 rounded-lg bg-muted p-1 text-sm" role="radiogroup" aria-label="Priority">
            {["ROUTINE", "URGENT"].map((p) => (
              <button key={p} type="button" role="radio" aria-checked={priority === p} onClick={() => setPriority(p)} className={cn("rounded-md px-3 py-1", priority === p ? (p === "URGENT" ? "bg-rose-600 text-white" : "bg-card shadow-sm") : "text-muted-foreground")}>
                {p === "URGENT" ? "Urgent" : "Routine"}
              </button>
            ))}
          </div>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Clinical note for the lab (e.g. ?dengue, on warfarin)" className="h-9 rounded-lg" />
          <Button type="submit" disabled={busy || !picked.length} className="h-9 rounded-lg">Order {picked.length || ""} test{picked.length === 1 ? "" : "s"}</Button>
        </div>
      </form>
    </Panel>
  );
}
