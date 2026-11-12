"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { recordVitals, addClinicalNote, createHandover, acknowledgeHandover } from "@/actions/nursing";
import { dischargePatient } from "@/actions/admissions";
import { Panel, Chip, Field, VitalFlags, VitalsLine } from "@/components/inpatient/ui";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtDateTime, fmtDate, ageSex, fullName, CONDITION_LABELS } from "@/lib/format";
import { lengthOfStayDays } from "@/lib/identifiers";
import { getRoleLabel } from "@/lib/roles";
import { BillingPanel } from "@/components/inpatient/billing-panel";
import { MedicationPanel, AllergyField } from "@/components/inpatient/medication-panel";
import { ResultsList, OrderTestsForm } from "@/components/lab/results-list";
import { DietPanel } from "@/components/meals/diet-panel";
import { DIET_LABELS } from "@/lib/diet/meals";
import { InsurancePanel, PAYER_LABELS } from "@/components/inpatient/insurance-panel";
import { cn } from "@/lib/utils";
import { ArrowLeft, CheckCircle2, FileText, Loader2, Plus, Trash2 } from "lucide-react";

/** Runs a server action, shows the toast and refreshes the page data. */
function useSubmit() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const run = async (fn, onDone) => {
    setBusy(true);
    try {
      const res = await fn();
      if (!res.success) {
        toast.error(res.message);
        return false;
      }
      toast[res.data?.flags?.length ? "warning" : "success"](res.message);
      onDone?.(res);
      router.refresh();
      return true;
    } finally {
      setBusy(false);
    }
  };
  return [busy, run];
}

export function AdmissionChart({ admission: a, viewer, bill, tariffs = [], medChart, formulary = [], labResults, labCatalog = [], meals }) {
  const unackedCritical = (labResults ?? []).filter((r) => r.critical && !r.criticalAckAt);
  const admitted = a.status === "ADMITTED";
  const latest = a.vitals[0];

  return (
    <div className="space-y-4">
      <Link href="/admissions" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {viewer.isPatient ? "My hospital stays" : "In-patients"}
      </Link>

      {/* Patient banner: everything the next person needs at a glance */}
      <section className="rounded-xl border border-border/70 bg-card">
        <div className="flex flex-col gap-3 border-b border-border/60 p-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">{fullName(a.patient)}</h1>
              <Chip tone={admitted ? "info" : "good"}>{admitted ? `Admitted · Day ${lengthOfStayDays(a.admittedAt)}` : "Discharged"}</Chip>
              {latest && <VitalFlags flags={latest.flags} />}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
              {a.patient.uhid} · {ageSex(a.patient)}{a.patient.bloodGroup ? ` · ${a.patient.bloodGroup}` : ""} · {a.admissionNumber}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2"><AllergyField patientId={a.patient.id} allergies={a.patient.allergies} canEdit={viewer.canEditAllergies && admitted} />{a.dietType && a.dietType !== "NORMAL" && <Chip tone={a.dietType === "NIL_BY_MOUTH" ? "bad" : "info"}>{DIET_LABELS[a.dietType]} diet</Chip>}</div>
          </div>
          {!admitted && (
            <Link href={`/admissions/${a.id}/summary`} className={cn(buttonVariants({ size: "sm" }), "gap-1.5 rounded-lg")}>
              <FileText className="size-4" /> Discharge summary
            </Link>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-4 md:grid-cols-4">
          <Field label="Bed">{a.bed.bedNumber} · {a.bed.ward.name}</Field>
          <Field label="Attending doctor">Dr. {fullName(a.doctor.user)}</Field>
          <Field label="Department">{a.department.name}</Field>
          <Field label="Admitted">{fmtDateTime(a.admittedAt)}</Field>
          <Field label="Reason for admission" className="col-span-2">{a.reason}</Field>
          <Field label="Provisional diagnosis">{a.provisionalDiagnosis}</Field>
          <Field label="Latest vitals"><VitalsLine v={latest} /></Field>
        </dl>
      </section>

      {unackedCritical.length > 0 && (
        <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          <span className="font-semibold">Critical lab result{unackedCritical.length > 1 ? "s" : ""}:</span>{" "}
          {unackedCritical.map((r) => `${r.test.name} (${(r.results ?? []).filter((x) => x.flag === "LL" || x.flag === "HH").map((x) => `${x.name} ${x.value} ${x.unit}`).join(", ")})`).join("; ")}
          {" "}— see the Tests tab to acknowledge.
        </div>
      )}

      <Tabs defaultValue="vitals" className="gap-3">
        <TabsList className="h-10 w-full justify-start overflow-x-auto rounded-lg sm:w-fit">
          <TabsTrigger value="vitals">Vitals</TabsTrigger>
          {labResults && <TabsTrigger value="tests">Tests ({labResults.length})</TabsTrigger>}
          {meals && <TabsTrigger value="diet">Diet</TabsTrigger>}
          {medChart && <TabsTrigger value="medicines">Medicines ({medChart.orders.filter((o) => o.status === "ACTIVE").length})</TabsTrigger>}
          {!viewer.isPatient && <TabsTrigger value="notes">Notes ({a.notes.length})</TabsTrigger>}
          {!viewer.isPatient && <TabsTrigger value="handover">Handover ({a.handovers.length})</TabsTrigger>}
          {(viewer.canDischarge || !admitted) && <TabsTrigger value="discharge">Discharge</TabsTrigger>}
          {bill && <TabsTrigger value="billing">Billing</TabsTrigger>}
          {bill && <TabsTrigger value="insurance">Insurance{bill.insurance.insured ? "" : " / payer"}</TabsTrigger>}
        </TabsList>

        <TabsContent value="vitals" className="space-y-4">
          {admitted && viewer.canChart && <VitalsForm admissionId={a.id} />}
          <VitalsHistory vitals={a.vitals} />
        </TabsContent>

        {labResults && (
          <TabsContent value="tests" className="space-y-4">
            {admitted && viewer.canOrderTests && <OrderTestsForm target={{ admissionId: a.id }} catalog={labCatalog} />}
            <Panel title="Results">
              <ResultsList results={labResults} canCollect={viewer.canCollectSamples && admitted} canAck={viewer.canAckCritical} empty="No tests ordered for this stay." />
            </Panel>
          </TabsContent>
        )}

        {meals && (
          <TabsContent value="diet">
            <DietPanel admissionId={a.id} meals={meals} canSetDiet={viewer.canSetDiet} canIntake={viewer.canRecordIntake} admitted={admitted} />
          </TabsContent>
        )}

        {medChart && (
          <TabsContent value="medicines">
            <MedicationPanel admissionId={a.id} chart={medChart} formulary={formulary} canOrder={viewer.canOrderMedicines} canChart={viewer.canChart} admitted={admitted} />
          </TabsContent>
        )}

        {!viewer.isPatient && (
          <TabsContent value="notes" className="space-y-4">
            {admitted && viewer.canChart && <NoteForm admissionId={a.id} role={viewer.role} />}
            <NotesTimeline notes={a.notes} />
          </TabsContent>
        )}

        {!viewer.isPatient && (
          <TabsContent value="handover" className="space-y-4">
            {admitted && viewer.canChart && <HandoverForm admissionId={a.id} />}
            <HandoverList handovers={a.handovers} viewer={viewer} />
          </TabsContent>
        )}

        <TabsContent value="discharge" className="space-y-3">
          {admitted && a.awaitingInsurer && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              Cashless stay ({PAYER_LABELS[a.payerType]}{a.insurerName ? ` — ${a.insurerName}` : ""}): discharge is held until the insurance desk records the insurer’s final approval.
            </div>
          )}
          {admitted ? <DischargeForm admission={a} /> : <DischargeDetails admission={a} />}
        </TabsContent>

        {bill && (
          <TabsContent value="billing">
            <BillingPanel bill={bill} tariffs={tariffs} canPost={viewer.canPostCharges} canFinalize={viewer.canFinalizeBill} />
          </TabsContent>
        )}
        {bill && (
          <TabsContent value="insurance">
            <InsurancePanel bill={bill} canEditPayer={viewer.canEditPayer} canWork={viewer.canWorkInsurance} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

const VITAL_INPUTS = [
  ["temperature", "Temp (°F)", "98.6", "0.1"],
  ["pulse", "Pulse (bpm)", "72"],
  ["systolic", "BP systolic", "120"],
  ["diastolic", "BP diastolic", "80"],
  ["respiratoryRate", "Resp. rate", "16"],
  ["spo2", "SpO₂ (%)", "98"],
  ["bloodSugar", "Sugar (mg/dL)", "110"],
  ["painScore", "Pain (0–10)", "0"],
];

function VitalsForm({ admissionId }) {
  const empty = Object.fromEntries(VITAL_INPUTS.map(([k]) => [k, ""]));
  const [values, setValues] = useState({ ...empty, notes: "" });
  const [busy, run] = useSubmit();
  return (
    <Panel title="Chart vitals">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(() => recordVitals(admissionId, values), () => setValues({ ...empty, notes: "" }));
        }}
        className="space-y-3"
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {VITAL_INPUTS.map(([key, label, placeholder, step]) => (
            <div key={key} className="space-y-1">
              <Label htmlFor={`v-${key}`} className="text-xs">{label}</Label>
              <Input id={`v-${key}`} type="number" inputMode="decimal" step={step ?? "1"} placeholder={placeholder} value={values[key]}
                onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))} className="h-10 rounded-lg tabular-nums" />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input placeholder="Remarks (optional)" value={values.notes} onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))} className="h-10 rounded-lg" />
          <Button type="submit" disabled={busy} className="gap-2 rounded-lg">{busy && <Loader2 className="size-4 animate-spin" />} Save vitals</Button>
        </div>
      </form>
    </Panel>
  );
}

function VitalsHistory({ vitals }) {
  return (
    <Panel title="Vitals chart" bodyClassName="p-0">
      {vitals.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">No vitals charted yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm tabular-nums">
            <thead className="border-b bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                {["Time", "Temp", "Pulse", "BP", "RR", "SpO₂", "Sugar", "Pain", "Alerts", "By"].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {vitals.map((v) => (
                <tr key={v.id}>
                  <td className="whitespace-nowrap px-3 py-2">{fmtDateTime(v.recordedAt)}</td>
                  <td className="px-3 py-2">{v.temperature ?? "—"}</td>
                  <td className="px-3 py-2">{v.pulse ?? "—"}</td>
                  <td className="px-3 py-2">{v.systolic != null ? `${v.systolic}/${v.diastolic}` : "—"}</td>
                  <td className="px-3 py-2">{v.respiratoryRate ?? "—"}</td>
                  <td className="px-3 py-2">{v.spo2 != null ? `${v.spo2}%` : "—"}</td>
                  <td className="px-3 py-2">{v.bloodSugar ?? "—"}</td>
                  <td className="px-3 py-2">{v.painScore ?? "—"}</td>
                  <td className="px-3 py-2"><VitalFlags flags={v.flags} empty={<span className="text-muted-foreground">—</span>} /></td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{fullName(v.recordedBy) || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function NoteForm({ admissionId, role }) {
  const [content, setContent] = useState("");
  const [busy, run] = useSubmit();
  return (
    <Panel title={role === "DOCTOR" ? "Add round note" : "Add nursing note"}>
      <form onSubmit={(e) => { e.preventDefault(); run(() => addClinicalNote(admissionId, { content }), () => setContent("")); }} className="space-y-2">
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder={role === "DOCTOR" ? "Findings, plan, orders for the team…" : "Observations, care given, patient complaints…"} className="min-h-24 rounded-lg" />
        <div className="flex justify-end">
          <Button type="submit" disabled={busy} className="gap-2 rounded-lg">{busy && <Loader2 className="size-4 animate-spin" />} Save note</Button>
        </div>
      </form>
    </Panel>
  );
}

function NotesTimeline({ notes }) {
  return (
    <Panel title="Clinical notes">
      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notes yet.</p>
      ) : (
        <ol className="space-y-4">
          {notes.map((n) => (
            <li key={n.id} className="border-l-2 border-border pl-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Chip tone={n.type === "DOCTOR_ROUND" ? "info" : "neutral"}>{n.type === "DOCTOR_ROUND" ? "Doctor round" : "Nursing"}</Chip>
                <span className="font-semibold text-foreground">{fullName(n.author) || "—"}</span>
                <span>{fmtDateTime(n.createdAt)}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm">{n.content}</p>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

const SBAR = [
  ["situation", "S — Situation", "What is happening now? e.g. Day 2 of dengue, febrile 101°F at 6 pm", true],
  ["background", "B — Background", "Relevant history, allergies, key results", false],
  ["assessment", "A — Assessment", "Your assessment of the patient right now", true],
  ["recommendation", "R — Recommendation", "What the next shift must do or watch for", true],
  ["pendingTasks", "Pending tasks", "Samples due, drips to change, reports awaited, family to inform…", false],
];

function HandoverForm({ admissionId }) {
  const empty = Object.fromEntries(SBAR.map(([k]) => [k, ""]));
  const [values, setValues] = useState(empty);
  const [busy, run] = useSubmit();
  return (
    <Panel title="Hand over to next shift (SBAR)">
      <form onSubmit={(e) => { e.preventDefault(); run(() => createHandover(admissionId, values), () => setValues(empty)); }} className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          {SBAR.map(([key, label, placeholder, required]) => (
            <div key={key} className={cn("space-y-1", key === "pendingTasks" && "md:col-span-2")}>
              <Label htmlFor={`h-${key}`} className="text-xs">{label}{required && <span className="text-rose-600"> *</span>}</Label>
              <Textarea id={`h-${key}`} value={values[key]} onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))} placeholder={placeholder} className="min-h-16 rounded-lg" />
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={busy} className="gap-2 rounded-lg">{busy && <Loader2 className="size-4 animate-spin" />} Record handover</Button>
        </div>
      </form>
    </Panel>
  );
}

function HandoverList({ handovers, viewer }) {
  const [busy, run] = useSubmit();
  return (
    <Panel title="Handover history">
      {handovers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No handovers recorded yet.</p>
      ) : (
        <ol className="space-y-4">
          {handovers.map((h) => {
            const canAck = viewer.canChart && !h.acknowledgedById && h.fromUserId !== viewer.id;
            return (
              <li key={h.id} className="rounded-lg border border-border/70 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{fullName(h.fromUser)}</span>
                    {h.fromUser?.role && ` (${getRoleLabel(h.fromUser.role)})`} · {fmtDateTime(h.createdAt)}
                  </div>
                  {h.acknowledgedById ? (
                    <Chip tone="good"><CheckCircle2 className="size-3" /> Received by {fullName(h.acknowledgedBy)} · {fmtDateTime(h.acknowledgedAt)}</Chip>
                  ) : canAck ? (
                    <Button size="sm" variant="outline" className="h-8 rounded-lg" disabled={busy} onClick={() => run(() => acknowledgeHandover(h.id))}>Acknowledge</Button>
                  ) : (
                    <Chip tone="warn">Awaiting next shift</Chip>
                  )}
                </div>
                <dl className="mt-2 grid gap-2 text-sm md:grid-cols-2">
                  <Field label="Situation">{h.situation}</Field>
                  <Field label="Background">{h.background}</Field>
                  <Field label="Assessment">{h.assessment}</Field>
                  <Field label="Recommendation">{h.recommendation}</Field>
                  {h.pendingTasks && <Field label="Pending tasks" className="md:col-span-2">{h.pendingTasks}</Field>}
                </dl>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}

const blankMed = { name: "", dose: "", frequency: "", duration: "" };

function DischargeForm({ admission }) {
  const [values, setValues] = useState({
    finalDiagnosis: admission.provisionalDiagnosis ?? "",
    treatmentGiven: "",
    conditionAtDischarge: "",
    dischargeAdvice: "",
    warningSigns: "",
    followUpDate: "",
    followUpTime: "10:00",
  });
  const [meds, setMeds] = useState([{ ...blankMed }]);
  const [busy, run] = useSubmit();
  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));
  const setMed = (i, k, val) => setMeds((list) => list.map((m, j) => (j === i ? { ...m, [k]: val } : m)));

  return (
    <Panel title="Discharge patient">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!confirm(`Discharge ${fullName(admission.patient)}? Bed ${admission.bed.bedNumber} will be sent for cleaning.`)) return;
          run(() => dischargePatient(admission.id, { ...values, dischargeMedications: meds }));
        }}
        className="space-y-4"
      >
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="d-dx" className="text-xs">Final diagnosis <span className="text-rose-600">*</span></Label>
            <Input id="d-dx" value={values.finalDiagnosis} onChange={set("finalDiagnosis")} className="h-10 rounded-lg" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="d-condition" className="text-xs">Condition at discharge <span className="text-rose-600">*</span></Label>
            <Select value={values.conditionAtDischarge} onValueChange={(v) => setValues((s) => ({ ...s, conditionAtDischarge: v }))}>
              <SelectTrigger id="d-condition" className="h-10 w-full rounded-lg"><SelectValue placeholder="Select condition" /></SelectTrigger>
              <SelectContent>
                {Object.entries(CONDITION_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="d-treatment" className="text-xs">Treatment given during the stay</Label>
            <Textarea id="d-treatment" value={values.treatmentGiven} onChange={set("treatmentGiven")} className="min-h-16 rounded-lg" />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Medicines to take at home</Label>
            <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setMeds((m) => [...m, { ...blankMed }])}>
              <Plus className="size-3.5" /> Add medicine
            </Button>
          </div>
          {meds.map((m, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-[2fr_1fr_1.5fr_1fr_auto]">
              <Input aria-label="Medicine" placeholder="Medicine & strength" value={m.name} onChange={(e) => setMed(i, "name", e.target.value)} className="col-span-2 h-9 rounded-lg sm:col-span-1" />
              <Input aria-label="Dose" placeholder="Dose" value={m.dose} onChange={(e) => setMed(i, "dose", e.target.value)} className="h-9 rounded-lg" />
              <Input aria-label="When" placeholder="When (e.g. after breakfast & dinner)" value={m.frequency} onChange={(e) => setMed(i, "frequency", e.target.value)} className="h-9 rounded-lg" />
              <Input aria-label="Duration" placeholder="For how long" value={m.duration} onChange={(e) => setMed(i, "duration", e.target.value)} className="h-9 rounded-lg" />
              <Button type="button" variant="ghost" size="icon" aria-label="Remove medicine" className="size-9" onClick={() => setMeds((list) => list.filter((_, j) => j !== i))}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="d-advice" className="text-xs">Advice at home (diet, activity, care)</Label>
            <Textarea id="d-advice" value={values.dischargeAdvice} onChange={set("dischargeAdvice")} className="min-h-20 rounded-lg" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="d-warning" className="text-xs">Come back immediately if…</Label>
            <Textarea id="d-warning" value={values.warningSigns} onChange={set("warningSigns")} placeholder="e.g. bleeding, breathlessness, fever above 102°F" className="min-h-20 rounded-lg" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="d-fu-date" className="text-xs">Follow-up visit date (books an appointment)</Label>
            <Input id="d-fu-date" type="date" value={values.followUpDate} onChange={set("followUpDate")} className="h-10 rounded-lg" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="d-fu-time" className="text-xs">Follow-up time</Label>
            <Input id="d-fu-time" type="time" value={values.followUpTime} onChange={set("followUpTime")} className="h-10 rounded-lg" />
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={busy} className="gap-2 rounded-lg">{busy && <Loader2 className="size-4 animate-spin" />} Discharge patient</Button>
        </div>
      </form>
    </Panel>
  );
}

function DischargeDetails({ admission: a }) {
  const meds = Array.isArray(a.dischargeMedications) ? a.dischargeMedications : [];
  return (
    <Panel title="Discharge" action={<Link href={`/admissions/${a.id}/summary`} className="text-xs font-semibold text-primary hover:underline">Patient-friendly summary →</Link>}>
      <dl className="grid gap-3 md:grid-cols-3">
        <Field label="Discharged">{fmtDateTime(a.dischargedAt)}</Field>
        <Field label="By">{fullName(a.dischargedBy)}</Field>
        <Field label="Condition">{CONDITION_LABELS[a.conditionAtDischarge]}</Field>
        <Field label="Final diagnosis" className="md:col-span-3">{a.finalDiagnosis}</Field>
        <Field label="Treatment given" className="md:col-span-3">{a.treatmentGiven}</Field>
        <Field label="Medicines" className="md:col-span-3">
          {meds.length ? (
            <ul className="list-disc pl-4">
              {meds.map((m, i) => <li key={i}>{[m.name, m.dose, m.frequency, m.duration].filter(Boolean).join(" · ")}</li>)}
            </ul>
          ) : null}
        </Field>
        <Field label="Advice">{a.dischargeAdvice}</Field>
        <Field label="Warning signs">{a.warningSigns}</Field>
        <Field label="Follow-up">{a.followUpDate ? fmtDate(a.followUpDate) : null}</Field>
      </dl>
    </Panel>
  );
}
