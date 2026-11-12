"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setPayer, requestPreAuth, respondPreAuth, submitClaim, settleClaim } from "@/actions/insurance";
import { Panel, Chip, Field } from "@/components/inpatient/ui";
import { UsageMeter } from "@/components/inpatient/billing-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtDate, fmtDateTime, inr } from "@/lib/format";
import { Plus, Trash2 } from "lucide-react";

export const PAYER_LABELS = { SELF: "Self-paying", INSURANCE: "Health insurance / TPA", CORPORATE: "Corporate", GOVERNMENT_SCHEME: "Government scheme (PMJAY / CGHS / ECHS)" };
const KIND_LABELS = { INITIAL: "Initial pre-authorisation", ENHANCEMENT: "Enhancement", FINAL: "Final approval" };
const STATUS_TONES = { SUBMITTED: "info", QUERY: "warn", APPROVED: "good", REJECTED: "bad", SETTLED: "good" };
const STATUS_LABELS = { SUBMITTED: "Awaiting insurer", QUERY: "Query raised", APPROVED: "Approved", REJECTED: "Rejected", SETTLED: "Settled" };

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

const dateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

export function PayerForm({ insurance, admissionId, canEdit, compact = false, onChange }) {
  const [v, setV] = useState({
    payerType: insurance?.payerType ?? "SELF",
    insurerName: insurance?.insurerName ?? "", tpaName: insurance?.tpaName ?? "", policyNumber: insurance?.policyNumber ?? "",
    memberId: insurance?.memberId ?? "", sumInsured: insurance?.sumInsured ?? "", policyValidTill: dateInput(insurance?.policyValidTill),
  });
  const [busy, run] = useRun();
  const set = (k) => (e) => { const next = { ...v, [k]: e.target.value }; setV(next); onChange?.(next); };
  const setType = (t) => { const next = { ...v, payerType: t }; setV(next); onChange?.(next); };
  const insured = v.payerType !== "SELF";

  const fields = (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="payer-type" className="text-xs">Who is paying?</Label>
        <Select value={v.payerType} onValueChange={setType} disabled={!canEdit}>
          <SelectTrigger id="payer-type" className="h-10 w-full rounded-lg sm:w-96"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(PAYER_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {insured && (
        <div className="grid gap-3 sm:grid-cols-3">
          {[["insurerName", "Insurer / scheme *", "e.g. Star Health, PMJAY"], ["tpaName", "TPA", "e.g. Medi Assist"], ["policyNumber", "Policy / card no. *", ""], ["memberId", "Member ID", ""], ["sumInsured", "Sum insured ₹", ""], ["policyValidTill", "Valid till", ""]].map(([k, l, ph]) => (
            <div key={k} className="space-y-1">
              <Label htmlFor={`payer-${k}`} className="text-xs">{l}</Label>
              <Input id={`payer-${k}`} type={k === "policyValidTill" ? "date" : k === "sumInsured" ? "number" : "text"} placeholder={ph} value={v[k]} onChange={set(k)} disabled={!canEdit} className="h-10 rounded-lg" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
  if (compact) return fields;
  return (
    <Panel title="Payer">
      <form onSubmit={(e) => { e.preventDefault(); run(() => setPayer(admissionId, v)); }} className="space-y-3">
        {fields}
        {canEdit && <Button type="submit" disabled={busy} className="h-10 rounded-lg">Save payer details</Button>}
      </form>
    </Panel>
  );
}

function RespondForm({ preAuth }) {
  const [v, setV] = useState({ status: "APPROVED", approvedAmount: String(preAuth.requestedAmount), referenceNumber: preAuth.referenceNumber ?? "", remarks: "" });
  const [busy, run] = useRun();
  return (
    <form onSubmit={(e) => { e.preventDefault(); run(() => respondPreAuth(preAuth.id, v)); }} className="mt-2 grid gap-2 rounded-lg bg-muted/40 p-3 sm:grid-cols-[150px_1fr_1fr_auto] sm:items-end">
      <div className="space-y-1">
        <Label className="text-xs">Insurer’s reply</Label>
        <Select value={v.status} onValueChange={(s) => setV((x) => ({ ...x, status: s }))}>
          <SelectTrigger className="h-9 w-full rounded-lg"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="APPROVED">Approved</SelectItem><SelectItem value="QUERY">Query</SelectItem><SelectItem value="REJECTED">Rejected</SelectItem></SelectContent>
        </Select>
      </div>
      {v.status === "APPROVED" ? (
        <div className="space-y-1"><Label className="text-xs">Approved ₹</Label><Input type="number" value={v.approvedAmount} onChange={(e) => setV((x) => ({ ...x, approvedAmount: e.target.value }))} className="h-9 rounded-lg" /></div>
      ) : (
        <div className="space-y-1"><Label className="text-xs">Query / reason *</Label><Input value={v.remarks} onChange={(e) => setV((x) => ({ ...x, remarks: e.target.value }))} className="h-9 rounded-lg" /></div>
      )}
      <div className="space-y-1"><Label className="text-xs">Insurer reference</Label><Input value={v.referenceNumber} onChange={(e) => setV((x) => ({ ...x, referenceNumber: e.target.value }))} className="h-9 rounded-lg" /></div>
      <Button type="submit" size="sm" disabled={busy} className="h-9 rounded-lg">Save reply</Button>
    </form>
  );
}

function RequestForm({ admissionId, insurance, billFinalized, finalTotal }) {
  const pre = insurance.preAuths.filter((p) => p.status !== "REJECTED");
  const initialApproved = pre.some((p) => p.kind === "INITIAL" && p.status === "APPROVED");
  // Most likely next step first: final approval once the bill is final, otherwise initial, then enhancement.
  const options = [
    billFinalized && !pre.some((p) => p.kind === "FINAL") && "FINAL",
    !pre.some((p) => p.kind === "INITIAL") && "INITIAL",
    !billFinalized && initialApproved && "ENHANCEMENT",
  ].filter(Boolean);
  const [kind, setKind] = useState(options[0] ?? "");
  const [amount, setAmount] = useState("");
  const [remarks, setRemarks] = useState("");
  const [busy, run] = useRun();
  if (!options.length) return null;
  const current = options.includes(kind) ? kind : options[0];
  return (
    <form onSubmit={(e) => { e.preventDefault(); run(() => requestPreAuth(admissionId, { kind: current, requestedAmount: current === "FINAL" ? amount || finalTotal : amount, remarks }), () => { setAmount(""); setRemarks(""); }); }} className="grid gap-2 sm:grid-cols-[220px_160px_1fr_auto] sm:items-end">
      <div className="space-y-1">
        <Label className="text-xs">Request</Label>
        <Select value={current} onValueChange={setKind}>
          <SelectTrigger className="h-10 w-full rounded-lg"><SelectValue /></SelectTrigger>
          <SelectContent>{options.map((o) => <SelectItem key={o} value={o}>{KIND_LABELS[o]}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1"><Label className="text-xs">Amount ₹</Label><Input type="number" min="1" placeholder={current === "FINAL" ? String(finalTotal) : ""} value={amount} onChange={(e) => setAmount(e.target.value)} className="h-10 rounded-lg" /></div>
      <div className="space-y-1"><Label className="text-xs">Diagnosis / justification</Label><Input value={remarks} onChange={(e) => setRemarks(e.target.value)} className="h-10 rounded-lg" /></div>
      <Button type="submit" disabled={busy || (current !== "FINAL" && !amount)} className="h-10 rounded-lg">Record request</Button>
    </form>
  );
}

function ClaimPanel({ admissionId, insurance, canWork, discharged }) {
  const claim = insurance.claim;
  const [v, setV] = useState({ status: "SETTLED", settledAmount: claim ? String(claim.claimedAmount) : "", utrNumber: "", remarks: "" });
  const [deductions, setDeductions] = useState([]);
  const [busy, run] = useRun();
  if (!discharged) return null;
  return (
    <Panel title="Claim">
      {!claim ? (
        insurance.finalApproved ? (
          canWork ? <Button disabled={busy} className="rounded-lg" onClick={() => run(() => submitClaim(admissionId, {}))}>File claim for {inr(insurance.approvedAmount)}</Button> : <p className="text-sm text-muted-foreground">Ready for the insurance desk to file.</p>
        ) : <p className="text-sm text-muted-foreground">The claim can be filed once the insurer’s final approval is recorded.</p>
      ) : (
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono font-semibold">{claim.claimNumber}</span>
            <Chip tone={STATUS_TONES[claim.status]}>{STATUS_LABELS[claim.status]}</Chip>
            <span className="text-muted-foreground">Claimed {inr(claim.claimedAmount)} · filed {fmtDate(claim.submittedAt)}</span>
          </div>
          {claim.status === "SETTLED" && (
            <dl className="grid gap-2 sm:grid-cols-3">
              <Field label="Settled">{inr(claim.settledAmount)}</Field>
              <Field label="UTR">{claim.utrNumber}</Field>
              <Field label="Deductions">{(claim.deductions ?? []).length ? (claim.deductions.map((d) => `${d.reason}: ${inr(d.amount)}`).join("; ")) : "None"}</Field>
            </dl>
          )}
          {canWork && (claim.status === "SUBMITTED" || claim.status === "QUERY") && (
            <form onSubmit={(e) => { e.preventDefault(); run(() => settleClaim(claim.id, { ...v, deductions })); }} className="space-y-2 rounded-lg bg-muted/40 p-3">
              <div className="grid gap-2 sm:grid-cols-[150px_1fr_1fr] sm:items-end">
                <div className="space-y-1">
                  <Label className="text-xs">Outcome</Label>
                  <Select value={v.status} onValueChange={(s) => setV((x) => ({ ...x, status: s }))}>
                    <SelectTrigger className="h-9 w-full rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="SETTLED">Settled</SelectItem><SelectItem value="QUERY">Query</SelectItem><SelectItem value="REJECTED">Rejected</SelectItem></SelectContent>
                  </Select>
                </div>
                {v.status === "SETTLED" ? (
                  <>
                    <div className="space-y-1"><Label className="text-xs">Amount received ₹</Label><Input type="number" value={v.settledAmount} onChange={(e) => setV((x) => ({ ...x, settledAmount: e.target.value }))} className="h-9 rounded-lg" /></div>
                    <div className="space-y-1"><Label className="text-xs">UTR / payment ref.</Label><Input value={v.utrNumber} onChange={(e) => setV((x) => ({ ...x, utrNumber: e.target.value }))} className="h-9 rounded-lg" /></div>
                  </>
                ) : (
                  <div className="space-y-1 sm:col-span-2"><Label className="text-xs">Query / reason *</Label><Input value={v.remarks} onChange={(e) => setV((x) => ({ ...x, remarks: e.target.value }))} className="h-9 rounded-lg" /></div>
                )}
              </div>
              {v.status === "SETTLED" && (
                <div className="space-y-1.5">
                  {deductions.map((d, i) => (
                    <div key={i} className="grid grid-cols-[1fr_120px_auto] gap-2">
                      <Input placeholder="Deduction reason" value={d.reason} onChange={(e) => setDeductions((l) => l.map((x, j) => (j === i ? { ...x, reason: e.target.value } : x)))} className="h-9 rounded-lg" />
                      <Input type="number" placeholder="₹" value={d.amount} onChange={(e) => setDeductions((l) => l.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} className="h-9 rounded-lg" />
                      <Button type="button" variant="ghost" size="icon" aria-label="Remove deduction" className="size-9" onClick={() => setDeductions((l) => l.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button>
                    </div>
                  ))}
                  <button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-primary" onClick={() => setDeductions((l) => [...l, { reason: "", amount: "" }])}><Plus className="size-3.5" /> Add deduction</button>
                </div>
              )}
              <Button type="submit" size="sm" disabled={busy} className="rounded-lg">Save</Button>
            </form>
          )}
        </div>
      )}
    </Panel>
  );
}

export function InsurancePanel({ bill, canEditPayer, canWork }) {
  const ins = bill.insurance;
  const admitted = bill.status === "ADMITTED";
  return (
    <div className="space-y-4">
      <PayerForm insurance={ins} admissionId={bill.admissionId} canEdit={canEditPayer && !ins.claim} />
      {ins.insured && (
        <Panel title="Pre-authorisation" action={<span className="text-xs text-muted-foreground">Approved so far {inr(ins.approvedAmount)}{ins.finalApproved ? " (final)" : ""}</span>}>
          <div className="space-y-4">
            <UsageMeter usage={ins.usage} approved={ins.approvedAmount} total={bill.totals.total} />
            {ins.preAuths.length === 0 ? (
              <p className="text-sm text-muted-foreground">No requests sent to the insurer yet.</p>
            ) : (
              <ol className="space-y-2">
                {ins.preAuths.map((p) => (
                  <li key={p.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">{KIND_LABELS[p.kind]}</span>
                      <Chip tone={STATUS_TONES[p.status]}>{STATUS_LABELS[p.status]}</Chip>
                    </div>
                    <div className="mt-1 text-muted-foreground">
                      Requested {inr(p.requestedAmount)} on {fmtDateTime(p.createdAt)}
                      {p.approvedAmount != null && <> · approved <span className="font-semibold text-foreground">{inr(p.approvedAmount)}</span></>}
                      {p.referenceNumber && <> · ref {p.referenceNumber}</>}
                    </div>
                    {p.remarks && <p className="mt-1">{p.remarks}</p>}
                    {p.responseRemarks && <p className="mt-1 text-amber-800 dark:text-amber-300">Insurer: {p.responseRemarks}</p>}
                    {canWork && (p.status === "SUBMITTED" || p.status === "QUERY") && <RespondForm preAuth={p} />}
                  </li>
                ))}
              </ol>
            )}
            {canWork && admitted && <RequestForm admissionId={bill.admissionId} insurance={ins} billFinalized={Boolean(bill.finalized)} finalTotal={bill.finalized?.amount ?? bill.totals.total} />}
            {admitted && !ins.finalApproved && <p className="text-xs text-muted-foreground">Discharge is held until the insurer’s final approval is recorded. Steps: prepare the final bill (Billing tab) → request final approval → record the insurer’s reply.</p>}
          </div>
        </Panel>
      )}
      {ins.insured && <ClaimPanel admissionId={bill.admissionId} insurance={ins} canWork={canWork} discharged={!admitted} />}
    </div>
  );
}
