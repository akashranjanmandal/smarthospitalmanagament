"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { postCharge, cancelCharge, recordPayment, finalizeBill } from "@/actions/ipd-billing";
import { Panel, Chip } from "@/components/inpatient/ui";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtDateTime, inr, CATEGORY_LABELS } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FileText, Loader2, Plus, X } from "lucide-react";


function useRun() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const run = async (fn, after) => {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.success) return toast.error(res.message), false;
    toast.success(res.message);
    after?.(res);
    router.refresh();
    return true;
  };
  return [busy, run];
}

export function UsageMeter({ usage, approved, total }) {
  if (usage.level === "none") return <span className="text-sm text-muted-foreground">No amount approved yet</span>;
  const tone = usage.level === "over" ? "bg-rose-500" : usage.level === "warn" ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{inr(total)} of {inr(approved)} approved</span>
        <span className={cn("font-semibold", usage.level !== "ok" && "text-rose-700 dark:text-rose-300")}>{usage.percent}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.min(usage.percent, 100)}%` }} />
      </div>
      {usage.level !== "ok" && <p className="text-xs font-medium text-amber-800 dark:text-amber-300">{usage.level === "over" ? "Bill is above the approved amount — request an enhancement." : "Bill has reached 80% of the approved amount — consider an enhancement."}</p>}
    </div>
  );
}

function Summary({ bill }) {
  const t = bill.totals;
  const cells = [
    ["Bill so far", inr(t.total)],
    ["Received", inr(t.received)],
    ...(bill.insurance.insured ? [["Insurer pays", inr(t.insurerPays)], ["Patient share", inr(t.patientShare)]] : []),
    [t.balanceDue >= 0 ? "Balance due" : "Refund due", inr(Math.abs(t.balanceDue))],
  ];
  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cells.map(([label, value], i) => (
          <div key={label} className={cn("rounded-lg border p-3", i === cells.length - 1 && (t.balanceDue > 0 ? "border-amber-300 bg-amber-50 dark:bg-amber-950/30" : "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30"))}>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
            <dd className="mt-0.5 text-lg font-bold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {bill.insurance.insured && <UsageMeter usage={bill.insurance.usage} approved={bill.insurance.approvedAmount} total={t.total} />}
    </div>
  );
}

function ChargeForm({ admissionId, tariffs }) {
  const [manual, setManual] = useState(false);
  const [q, setQ] = useState("");
  const [tariffId, setTariffId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [item, setItem] = useState({ description: "", category: "OTHER", unitPrice: "", gstRate: "0" });
  const [busy, run] = useRun();
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    return tariffs.filter((t) => t.category !== "ROOM" && (!s || t.name.toLowerCase().includes(s) || t.code.toLowerCase().includes(s))).slice(0, 60);
  }, [q, tariffs]);

  const submit = (e) => {
    e.preventDefault();
    const data = manual ? { ...item, quantity } : { tariffId, quantity };
    run(() => postCharge(admissionId, data), () => { setTariffId(""); setQuantity("1"); setItem({ description: "", category: "OTHER", unitPrice: "", gstRate: "0" }); });
  };

  return (
    <Panel title="Add a charge" action={<button type="button" onClick={() => setManual((m) => !m)} className="text-xs font-semibold text-primary hover:underline">{manual ? "Choose from price list" : "Item not in price list?"}</button>}>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_1.4fr_90px_auto] sm:items-end">
        {manual ? (
          <>
            <div className="space-y-1"><Label className="text-xs">Description</Label><Input value={item.description} onChange={(e) => setItem((i) => ({ ...i, description: e.target.value }))} className="h-10 rounded-lg" /></div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Category</Label>
                <Select value={item.category} onValueChange={(v) => setItem((i) => ({ ...i, category: v }))}>
                  <SelectTrigger className="h-10 w-full rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(CATEGORY_LABELS).filter(([k]) => k !== "ROOM").map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs">Rate ₹</Label><Input type="number" min="0" value={item.unitPrice} onChange={(e) => setItem((i) => ({ ...i, unitPrice: e.target.value }))} className="h-10 rounded-lg" /></div>
              <div className="space-y-1"><Label className="text-xs">GST %</Label><Input type="number" min="0" value={item.gstRate} onChange={(e) => setItem((i) => ({ ...i, gstRate: e.target.value }))} className="h-10 rounded-lg" /></div>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-1"><Label htmlFor="tariff-search" className="text-xs">Find item</Label><Input id="tariff-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. CBC, X-ray, saline" className="h-10 rounded-lg" /></div>
            <div className="space-y-1">
              <Label htmlFor="tariff-pick" className="text-xs">Item</Label>
              <Select value={tariffId} onValueChange={setTariffId}>
                <SelectTrigger id="tariff-pick" className="h-10 w-full rounded-lg"><SelectValue placeholder={`Choose from ${matches.length} items`} /></SelectTrigger>
                <SelectContent>{matches.map((t) => <SelectItem key={t.id} value={t.id}>{t.name} · {inr(t.price)}{t.gstRate ? ` + ${t.gstRate}% GST` : ""}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </>
        )}
        <div className="space-y-1"><Label htmlFor="charge-qty" className="text-xs">Qty</Label><Input id="charge-qty" type="number" min="1" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="h-10 rounded-lg" /></div>
        <Button type="submit" disabled={busy || (!manual && !tariffId)} className="h-10 gap-1.5 rounded-lg">{busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Add</Button>
      </form>
    </Panel>
  );
}

function Lines({ bill, canCancel }) {
  const [busy, run] = useRun();
  const t = bill.totals;
  return (
    <Panel title="Itemised bill" bodyClassName="p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <tr><th className="px-3 py-2">Item</th><th className="px-3 py-2">Category</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Rate</th><th className="px-3 py-2 text-right">GST</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2">Added</th><th className="w-10" /></tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            <tr>
              <td className="px-3 py-2 font-medium">Room charges ({bill.bedType.replace("_", " ").toLowerCase()})</td>
              <td className="px-3 py-2">Room</td>
              <td className="px-3 py-2 text-right tabular-nums">{t.room.days} day{t.room.days === 1 ? "" : "s"}</td>
              <td className="px-3 py-2 text-right tabular-nums">{inr(t.room.rate)}</td>
              <td className="px-3 py-2 text-right">—</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">{inr(t.room.total)}</td>
              <td className="px-3 py-2 text-xs text-muted-foreground">{bill.finalized ? "Frozen on final bill" : "Grows daily"}</td>
              <td />
            </tr>
            {bill.lines.map((l) => (
              <tr key={l.id} className={cn(l.cancelled && "text-muted-foreground line-through decoration-muted-foreground/60")}>
                <td className="px-3 py-2">
                  <span className="font-medium">{l.description}</span>
                  {l.cancelled && <span className="block text-xs no-underline [text-decoration:none]">Cancelled by {l.cancelledBy}: {l.cancelReason}</span>}
                </td>
                <td className="px-3 py-2">{CATEGORY_LABELS[l.category]}</td>
                <td className="px-3 py-2 text-right tabular-nums">{l.quantity}</td>
                <td className="px-3 py-2 text-right tabular-nums">{inr(l.unitPrice)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{l.gstRate ? `${l.gstRate}%` : "—"}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">{inr(l.amount)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{fmtDateTime(l.postedAt)} · {l.postedBy}</td>
                <td className="px-2 py-2">
                  {canCancel && !l.cancelled && !bill.finalized && (
                    <button type="button" aria-label={`Cancel ${l.description}`} disabled={busy} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-rose-600"
                      onClick={() => { const reason = prompt(`Why cancel "${l.description}"?`); if (reason !== null) run(() => cancelCharge(l.id, reason)); }}>
                      <X className="size-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t text-sm">
            <tr><td colSpan={5} className="px-3 py-1.5 text-right text-muted-foreground">Subtotal</td><td className="px-3 py-1.5 text-right tabular-nums">{inr(t.subtotal)}</td><td colSpan={2} /></tr>
            <tr><td colSpan={5} className="px-3 py-1.5 text-right text-muted-foreground">GST</td><td className="px-3 py-1.5 text-right tabular-nums">{inr(t.gst)}</td><td colSpan={2} /></tr>
            {t.discount > 0 && <tr><td colSpan={5} className="px-3 py-1.5 text-right text-muted-foreground">Discount</td><td className="px-3 py-1.5 text-right tabular-nums">− {inr(t.discount)}</td><td colSpan={2} /></tr>}
            <tr className="font-bold"><td colSpan={5} className="px-3 py-2 text-right">Total</td><td className="px-3 py-2 text-right tabular-nums">{inr(t.total)}</td><td colSpan={2} /></tr>
          </tfoot>
        </table>
      </div>
    </Panel>
  );
}

function Payments({ bill, admissionId, canTake }) {
  const [form, setForm] = useState({ kind: "DEPOSIT", amount: "", method: "UPI", reference: "" });
  const [busy, run] = useRun();
  return (
    <Panel title="Deposits, payments and refunds">
      {canTake && (
        <form onSubmit={(e) => { e.preventDefault(); run(() => recordPayment(admissionId, form), () => setForm((f) => ({ ...f, amount: "", reference: "" }))); }} className="mb-4 grid gap-2 sm:grid-cols-[140px_1fr_120px_1fr_auto] sm:items-end">
          <div className="space-y-1">
            <Label className="text-xs">Type</Label>
            <Select value={form.kind} onValueChange={(v) => setForm((f) => ({ ...f, kind: v }))}>
              <SelectTrigger className="h-10 w-full rounded-lg"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="DEPOSIT">Deposit</SelectItem><SelectItem value="PAYMENT">Payment</SelectItem><SelectItem value="REFUND">Refund</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label htmlFor="pay-amount" className="text-xs">Amount ₹</Label><Input id="pay-amount" type="number" min="1" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className="h-10 rounded-lg" /></div>
          <div className="space-y-1">
            <Label className="text-xs">Mode</Label>
            <Select value={form.method} onValueChange={(v) => setForm((f) => ({ ...f, method: v }))}>
              <SelectTrigger className="h-10 w-full rounded-lg"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="UPI">UPI</SelectItem><SelectItem value="CARD">Card</SelectItem><SelectItem value="CASH">Cash</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label htmlFor="pay-ref" className="text-xs">Reference (UPI / card)</Label><Input id="pay-ref" value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} className="h-10 rounded-lg" /></div>
          <Button type="submit" disabled={busy || !form.amount} className="h-10 rounded-lg">Record</Button>
        </form>
      )}
      {bill.payments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No money received yet.</p>
      ) : (
        <ul className="divide-y divide-border/60 rounded-lg border text-sm">
          {bill.payments.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <span><Chip tone={p.kind === "REFUND" ? "warn" : "good"}>{p.kind === "DEPOSIT" ? "Deposit" : p.kind === "PAYMENT" ? "Payment" : "Refund"}</Chip> <span className="ml-1 font-mono text-xs">{p.receiptNumber}</span></span>
              <span className="text-xs text-muted-foreground">{p.method}{p.reference ? ` · ${p.reference}` : ""} · {fmtDateTime(p.createdAt)} · {p.receivedBy}</span>
              <span className="font-semibold tabular-nums">{p.kind === "REFUND" ? "− " : ""}{inr(p.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Finalize({ bill, admissionId, canFinalize }) {
  const [discount, setDiscount] = useState("");
  const [busy, run] = useRun();
  if (bill.finalized) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4 dark:bg-emerald-950/30">
        <div className="text-sm"><span className="font-semibold">Final bill {bill.finalized.billNumber}</span> · {inr(bill.finalized.amount)} · prepared {fmtDateTime(bill.finalized.finalizedAt)}</div>
        <Link href={`/admissions/${admissionId}/bill`} className={cn(buttonVariants({ size: "sm" }), "gap-1.5 rounded-lg")}><FileText className="size-4" /> View / print bill</Link>
      </div>
    );
  }
  if (!canFinalize) return null;
  return (
    <Panel title="Prepare final bill">
      <form onSubmit={(e) => { e.preventDefault(); if (confirm("Prepare the final bill? Room days and charges will be frozen.")) run(() => finalizeBill(admissionId, { discount: Number(discount) || 0 })); }} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="space-y-1"><Label htmlFor="bill-discount" className="text-xs">Discount ₹ (optional)</Label><Input id="bill-discount" type="number" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} className="h-10 w-48 rounded-lg" /></div>
        <Button type="submit" disabled={busy} className="h-10 rounded-lg">Prepare final bill</Button>
        <p className="text-xs text-muted-foreground sm:ml-2 sm:self-center">Freezes room days and charges and issues the bill number. Insured patients need this before final approval.</p>
      </form>
    </Panel>
  );
}

export function BillingPanel({ bill, tariffs, canPost, canFinalize }) {
  const open = !bill.finalized && bill.status === "ADMITTED";
  return (
    <div className="space-y-4">
      <Summary bill={bill} />
      {canPost && open && <ChargeForm admissionId={bill.admissionId} tariffs={tariffs} />}
      <Lines bill={bill} canCancel={canFinalize} />
      <Payments bill={bill} admissionId={bill.admissionId} canTake={canPost} />
      <Finalize bill={bill} admissionId={bill.admissionId} canFinalize={canFinalize} />
    </div>
  );
}
