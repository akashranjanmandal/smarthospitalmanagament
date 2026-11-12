"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { orderMedication, stopMedication, recordDose } from "@/actions/medication-orders";
import { updateAllergies } from "@/actions/patients";
import { Panel, Chip } from "@/components/inpatient/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtDateTime, fmtTime } from "@/lib/format";
import { AlertTriangle, Check, Pencil, X } from "lucide-react";

const ROUTES = { ORAL: "Oral", IV: "IV", IM: "IM", SC: "Subcutaneous", INHALED: "Inhaled", TOPICAL: "Topical", SUBLINGUAL: "Sublingual", RECTAL: "Rectal", NASAL: "Nasal", EYE: "Eye", EAR: "Ear" };
const FREQ = { OD: "Once a day (OD)", BD: "Twice a day (BD)", TDS: "Three times (TDS)", QID: "Four times (QID)", HS: "At bedtime (HS)", SOS: "When needed (SOS)", STAT: "Once now (STAT)" };
const SUPPLY = { RECEIVED: "Sent to pharmacy", PREPARING: "Pharmacy preparing", READY: "Ready at pharmacy", DISPENSED: "On the ward", CANCELLED: "Cancelled" };

function useRun() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const run = async (fn, after) => {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (res.needsConfirmation) return res;
    if (!res.success) return toast.error(res.message), res;
    toast.success(res.message);
    after?.(res);
    router.refresh();
    return res;
  };
  return [busy, run];
}

/** Allergy line on the chart banner; doctors and nurses can correct it. */
export function AllergyField({ patientId, allergies, canEdit }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(allergies ?? "");
  const [busy, run] = useRun();
  if (editing) {
    return (
      <form className="flex items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); run(() => updateAllergies(patientId, text), () => setEditing(false)); }}>
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Penicillin, sulfa (leave empty if none)" className="h-8 w-72 rounded-md text-sm" autoFocus aria-label="Allergies" />
        <Button size="icon" type="submit" className="size-8" disabled={busy} aria-label="Save allergies"><Check className="size-4" /></Button>
        <Button size="icon" type="button" variant="ghost" className="size-8" onClick={() => setEditing(false)} aria-label="Cancel"><X className="size-4" /></Button>
      </form>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      {allergies ? <Chip tone="bad"><AlertTriangle className="size-3" /> Allergies: {allergies}</Chip> : <Chip>No known allergies</Chip>}
      {canEdit && <button type="button" onClick={() => setEditing(true)} className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label="Edit allergies"><Pencil className="size-3.5" /></button>}
    </span>
  );
}

function OrderForm({ admissionId, formulary }) {
  const empty = { medicineId: "", dose: "", route: "ORAL", frequency: "BD", durationDays: "", instructions: "" };
  const [v, setV] = useState(empty);
  const [warnings, setWarnings] = useState(null);
  const [busy, run] = useRun();
  const submit = async (acknowledgeWarnings = false) => {
    const res = await run(() => orderMedication(admissionId, { ...v, acknowledgeWarnings }), () => { setV(empty); setWarnings(null); });
    if (res?.needsConfirmation) setWarnings(res.warnings);
  };
  const med = formulary.find((m) => m.id === v.medicineId);
  return (
    <Panel title="Order a medicine">
      <form onSubmit={(e) => { e.preventDefault(); submit(false); }} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1.3fr_0.8fr]">
          <div className="space-y-1">
            <Label htmlFor="mo-med" className="text-xs">Medicine</Label>
            <Select value={v.medicineId} onValueChange={(x) => setV((s) => ({ ...s, medicineId: x, dose: s.dose || formulary.find((m) => m.id === x)?.strength || "" }))}>
              <SelectTrigger id="mo-med" className="h-10 w-full rounded-lg"><SelectValue placeholder="Choose from formulary" /></SelectTrigger>
              <SelectContent>{formulary.map((m) => <SelectItem key={m.id} value={m.id}>{m.name} · {m.genericName}{m.stockOnHand ? "" : " · out of stock"}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label htmlFor="mo-dose" className="text-xs">Dose</Label><Input id="mo-dose" value={v.dose} onChange={(e) => setV((s) => ({ ...s, dose: e.target.value }))} placeholder="650 mg" className="h-10 rounded-lg" /></div>
          <div className="space-y-1">
            <Label htmlFor="mo-route" className="text-xs">Route</Label>
            <Select value={v.route} onValueChange={(x) => setV((s) => ({ ...s, route: x }))}>
              <SelectTrigger id="mo-route" className="h-10 w-full rounded-lg"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(ROUTES).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="mo-freq" className="text-xs">How often</Label>
            <Select value={v.frequency} onValueChange={(x) => setV((s) => ({ ...s, frequency: x }))}>
              <SelectTrigger id="mo-freq" className="h-10 w-full rounded-lg"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(FREQ).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label htmlFor="mo-days" className="text-xs">Days</Label><Input id="mo-days" type="number" min="1" value={v.durationDays} onChange={(e) => setV((s) => ({ ...s, durationDays: e.target.value }))} placeholder="5" className="h-10 rounded-lg" /></div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input value={v.instructions} onChange={(e) => setV((s) => ({ ...s, instructions: e.target.value }))} placeholder="Instructions (e.g. after food, check BP before giving)" className="h-10 rounded-lg" />
          <Button type="submit" disabled={busy || !v.medicineId} className="h-10 rounded-lg">Order</Button>
        </div>
        {med && med.stockOnHand === 0 && <p className="text-xs text-amber-800 dark:text-amber-300">{med.name} is out of stock — the pharmacy will substitute or ask you.</p>}
        {warnings && (
          <div role="alert" className="space-y-2 rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
            <ul className="list-disc pl-5">{warnings.map((w, i) => <li key={i}>{w.message}</li>)}</ul>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" className="rounded-md" onClick={() => setWarnings(null)}>Change order</Button>
              <Button type="button" size="sm" className="rounded-md bg-rose-700 text-white hover:bg-rose-800" disabled={busy} onClick={() => submit(true)}>I have checked — order anyway</Button>
            </div>
          </div>
        )}
      </form>
    </Panel>
  );
}

function DoseSlot({ order, slot, canChart }) {
  const [reasonFor, setReasonFor] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, run] = useRun();
  if (slot.status === "GIVEN") return <Chip tone="good" className="whitespace-normal"><Check className="size-3" /> {slot.time} given · {slot.givenBy} {fmtTime(slot.givenAt)}</Chip>;
  if (slot.status !== "DUE") return <Chip tone="warn" className="whitespace-normal">{slot.time} {slot.status.toLowerCase()} · {slot.notes}</Chip>;
  if (!canChart || order.status !== "ACTIVE") return <Chip>{slot.time} due</Chip>;
  if (reasonFor) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={`Why not given at ${slot.time}?`} className="h-8 w-52 rounded-md text-xs" autoFocus />
        <Button size="sm" variant="outline" className="h-8 rounded-md" disabled={busy} onClick={() => run(() => recordDose(order.id, { status: "HELD", slot: slot.time, notes: reason }))}>Held</Button>
        <Button size="sm" variant="outline" className="h-8 rounded-md" disabled={busy} onClick={() => run(() => recordDose(order.id, { status: "REFUSED", slot: slot.time, notes: reason }))}>Refused</Button>
        <Button size="icon" variant="ghost" className="size-8" onClick={() => setReasonFor(false)} aria-label="Cancel"><X className="size-4" /></Button>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md border px-1.5 py-1">
      <span className="text-xs font-semibold tabular-nums">{slot.time}</span>
      <Button size="sm" className="h-7 rounded-md px-2 text-xs" disabled={busy} onClick={() => run(() => recordDose(order.id, { status: "GIVEN", slot: slot.time }))}>Given</Button>
      <Button size="sm" variant="ghost" className="h-7 rounded-md px-2 text-xs" onClick={() => setReasonFor(true)}>Not given</Button>
    </span>
  );
}

function OrderRow({ order, canChart, canOrder }) {
  const [stopping, setStopping] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, run] = useRun();
  const stopped = order.status === "STOPPED";
  return (
    <li className={stopped ? "py-3 opacity-70" : "py-3"}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold">{order.name} <span className="font-normal text-muted-foreground">— {order.dose} · {ROUTES[order.route]} · {FREQ[order.frequency] ?? order.frequency}{order.durationDays ? ` · ${order.durationDays} days` : ""}</span></div>
          {order.instructions && <div className="text-sm">{order.instructions}</div>}
          <div className="text-xs text-muted-foreground">Ordered by {order.orderedBy} · {fmtDateTime(order.startAt)}{stopped ? ` · stopped by ${order.stoppedBy}: ${order.stopReason}` : ""}</div>
        </div>
        <div className="flex items-center gap-2">
          {order.supply && <Chip tone={order.supply.status === "DISPENSED" ? "good" : "info"}>{SUPPLY[order.supply.status]}</Chip>}
          {stopped ? <Chip>Stopped</Chip> : canOrder && !stopping && <Button size="sm" variant="ghost" className="h-8 rounded-md text-rose-700" onClick={() => setStopping(true)}>Stop</Button>}
        </div>
      </div>
      {stopping && (
        <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); run(() => stopMedication(order.id, reason), () => setStopping(false)); }}>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for stopping" className="h-8 rounded-md" autoFocus />
          <Button size="sm" type="submit" className="h-8 rounded-md" disabled={busy}>Stop medicine</Button>
          <Button size="sm" type="button" variant="ghost" className="h-8 rounded-md" onClick={() => setStopping(false)}>Cancel</Button>
        </form>
      )}
      {!stopped && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {order.today.length ? order.today.map((s) => <DoseSlot key={s.time} order={order} slot={s} canChart={canChart} />) : <span className="text-xs text-muted-foreground">Given when needed — no fixed times</span>}
          {canChart && (order.frequency === "SOS" || order.frequency === "STAT") && (
            <Button size="sm" variant="outline" className="h-8 rounded-md" disabled={busy} onClick={() => run(() => recordDose(order.id, { status: "GIVEN" }))}>Record a dose now</Button>
          )}
        </div>
      )}
    </li>
  );
}

export function MedicationPanel({ admissionId, chart, formulary, canOrder, canChart, admitted }) {
  const active = chart.orders.filter((o) => o.status === "ACTIVE");
  const stopped = chart.orders.filter((o) => o.status === "STOPPED");
  return (
    <div className="space-y-4">
      {admitted && canOrder && <OrderForm admissionId={admissionId} formulary={formulary} />}
      <Panel title={`Medication chart · today (${active.length} active)`}>
        {chart.orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No medicines ordered yet.</p>
        ) : (
          <ul className="divide-y divide-border/60">{[...active, ...stopped].map((o) => <OrderRow key={o.id} order={o} canChart={canChart && admitted} canOrder={canOrder && admitted} />)}</ul>
        )}
      </Panel>
    </div>
  );
}
