"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { collectSample, enterResults, verifyResults } from "@/actions/lab";
import { ResultTable } from "@/components/lab/results-list";
import { Chip } from "@/components/inpatient/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatRange } from "@/lib/lab/results";
import { ageSex, fmtTime, fullName } from "@/lib/format";
import { AlertTriangle } from "lucide-react";

function useRun() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const run = async (fn) => {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.success) return toast.error(res.message);
    toast[res.data?.critical ? "warning" : "success"](res.message);
    router.refresh();
  };
  return [busy, run];
}

function Header({ o }) {
  return (
    <div className="space-y-0.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-semibold">{o.test.name}</span>
        {o.priority === "URGENT" && <Chip tone="bad">Urgent</Chip>}
        {o.critical && <Chip tone="bad"><AlertTriangle className="size-3" /> Critical</Chip>}
      </div>
      <div className="text-sm">{fullName(o.patient)} <span className="text-muted-foreground tabular-nums">· {o.patient.uhid} · {ageSex(o.patient)}</span></div>
      <div className="text-xs text-muted-foreground">
        {o.admission ? `Ward ${o.admission.bed.bedNumber}, ${o.admission.bed.ward.name}` : "Out-patient"} · {o.orderNumber}
        {o.accessionNumber ? ` · sample ${o.accessionNumber}` : ""}{o.test.sampleType ? ` · ${o.test.sampleType}` : ""}
        {o.clinicalNotes ? ` · “${o.clinicalNotes}”` : ""}
      </div>
    </div>
  );
}

function ResultForm({ o }) {
  const params = Array.isArray(o.test.parameters) ? o.test.parameters : [];
  const [values, setValues] = useState({});
  const [report, setReport] = useState("");
  const [busy, run] = useRun();
  return (
    <form onSubmit={(e) => { e.preventDefault(); run(() => enterResults(o.id, { values, reportText: report })); }} className="space-y-2">
      {params.length ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {params.map((p) => (
            <label key={p.name} className="space-y-0.5 text-xs">
              <span className="font-medium">{p.name}</span> <span className="text-muted-foreground">({formatRange(p)}{p.unit ? ` ${p.unit}` : ""})</span>
              {p.type === "choice" ? (
                <Select value={values[p.name] ?? ""} onValueChange={(v) => setValues((x) => ({ ...x, [p.name]: v }))}>
                  <SelectTrigger className="h-9 w-full rounded-md" aria-label={p.name}><SelectValue placeholder="Choose" /></SelectTrigger>
                  <SelectContent>{p.options.map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
                </Select>
              ) : (
                <Input inputMode="decimal" aria-label={p.name} value={values[p.name] ?? ""} onChange={(e) => setValues((x) => ({ ...x, [p.name]: e.target.value }))} className="h-9 rounded-md tabular-nums" />
              )}
            </label>
          ))}
        </div>
      ) : (
        <Textarea value={report} onChange={(e) => setReport(e.target.value)} placeholder="Findings and impression" aria-label="Report" className="min-h-24 rounded-md" />
      )}
      <Button type="submit" size="sm" disabled={busy} className="rounded-md">Save results</Button>
    </form>
  );
}

function Card({ o, children }) {
  return <article className={`space-y-3 rounded-xl border bg-card p-3 ${o.critical ? "border-rose-300 dark:border-rose-900" : "border-border/70"}`}><Header o={o} />{children}</article>;
}

function Column({ title, hint, items, render }) {
  return (
    <section className="space-y-3 rounded-xl bg-muted/40 p-3">
      <div>
        <h2 className="flex items-center justify-between text-sm font-semibold">{title} <span className="rounded-md bg-card px-2 py-0.5 text-xs tabular-nums">{items.length}</span></h2>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      {items.length ? items.map(render) : <p className="px-1 text-sm text-muted-foreground">Nothing here.</p>}
    </section>
  );
}

export function LabWorklist({ data, canResult, userId }) {
  const router = useRouter();
  const [busy, run] = useRun();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 20000);
    return () => clearInterval(t);
  }, [router]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{canResult ? "Lab & Radiology Worklist" : "Samples to Collect"}</h1>
        <p className="text-sm text-muted-foreground">Urgent tests first. Results reach the doctor only after a second person verifies them.</p>
      </div>
      <div className={`grid gap-4 ${canResult ? "xl:grid-cols-3" : ""}`}>
        <Column title="To collect" hint="Take the sample and label it with the sample number" items={data.toCollect} render={(o) => (
          <Card key={o.id} o={o}>
            <Button size="sm" className="rounded-md" disabled={busy} onClick={() => run(() => collectSample(o.id))}>{o.test.department === "LAB" ? "Sample collected" : "Done — patient imaged"}</Button>
          </Card>
        )} />
        {canResult && (
          <Column title="Enter results" hint="Values are checked against normal ranges" items={data.inLab} render={(o) => (
            <Card key={o.id} o={o}>
              <p className="text-xs text-muted-foreground">Collected {fmtTime(o.collectedAt)}</p>
              <ResultForm o={o} />
            </Card>
          )} />
        )}
        {canResult && (
          <Column title="To verify" hint="Check and release — must be someone other than who entered them" items={data.toVerify} render={(o) => (
            <Card key={o.id} o={o}>
              {o.results && <ResultTable results={o.results} compact />}
              {o.reportText && <p className="whitespace-pre-wrap rounded-md bg-muted/40 p-2 text-sm">{o.reportText}</p>}
              {o.resultedById === userId ? (
                <p className="text-xs text-muted-foreground">You entered these results — another colleague must verify.</p>
              ) : (
                <Button size="sm" className="rounded-md" disabled={busy} onClick={() => run(() => verifyResults(o.id))}>Verify and release</Button>
              )}
            </Card>
          )} />
        )}
      </div>
      {canResult && data.doneToday.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Released today ({data.doneToday.length})</h2>
          <ul className="divide-y divide-border/60 rounded-xl border bg-card text-sm">
            {data.doneToday.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span>{o.test.name} · {fullName(o.patient)} <span className="text-muted-foreground">· {o.accessionNumber}</span></span>
                <span className="flex items-center gap-2">{o.critical && <Chip tone="bad">Critical</Chip>}<span className="text-xs text-muted-foreground">{fmtTime(o.verifiedAt)}</span></span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
