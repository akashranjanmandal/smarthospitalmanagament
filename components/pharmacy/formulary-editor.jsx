"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveMedicine, receiveStock } from "@/actions/pharmacy";
import { Chip } from "@/components/inpatient/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtDate, inr } from "@/lib/format";
import { ChevronDown, ChevronRight, PackagePlus, Plus } from "lucide-react";

const FORMS = ["TABLET", "CAPSULE", "SYRUP", "INJECTION", "INFUSION", "CREAM", "DROPS", "INHALER", "POWDER", "OTHER"];
const blank = { name: "", genericName: "", strength: "", form: "TABLET", schedule: "H", unitPrice: "", gstRate: "12", reorderLevel: "50" };

function useSave() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const save = async (fn, after) => {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.success) return toast.error(res.message);
    toast.success(res.message);
    after?.();
    router.refresh();
  };
  return [busy, save];
}

function ReceiveForm({ medicine }) {
  const [v, setV] = useState({ batchNumber: "", expiryDate: "", quantity: "" });
  const [busy, save] = useSave();
  return (
    <form onSubmit={(e) => { e.preventDefault(); save(() => receiveStock(medicine.id, v), () => setV({ batchNumber: "", expiryDate: "", quantity: "" })); }} className="flex flex-wrap items-end gap-2">
      <label className="space-y-1 text-xs font-medium">Batch no.<Input value={v.batchNumber} onChange={(e) => setV((x) => ({ ...x, batchNumber: e.target.value }))} className="h-8 w-32 rounded-md font-mono" /></label>
      <label className="space-y-1 text-xs font-medium">Expiry<Input type="date" value={v.expiryDate} onChange={(e) => setV((x) => ({ ...x, expiryDate: e.target.value }))} className="h-8 rounded-md" /></label>
      <label className="space-y-1 text-xs font-medium">Quantity<Input type="number" min="1" value={v.quantity} onChange={(e) => setV((x) => ({ ...x, quantity: e.target.value }))} className="h-8 w-24 rounded-md" /></label>
      <Button type="submit" size="sm" className="h-8 gap-1 rounded-md" disabled={busy}><PackagePlus className="size-3.5" /> Receive stock</Button>
    </form>
  );
}

export function FormularyEditor({ medicines }) {
  const [q, setQ] = useState("");
  const [onlyAlerts, setOnlyAlerts] = useState(false);
  const [open, setOpen] = useState(null);
  const [form, setForm] = useState(blank);
  const [busy, save] = useSave();

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return medicines.filter((m) => (!s || m.name.toLowerCase().includes(s) || m.genericName.toLowerCase().includes(s)) && (!onlyAlerts || m.lowStock || m.expiringSoon || m.expiredUnits));
  }, [medicines, q, onlyAlerts]);
  const alerts = medicines.filter((m) => m.lowStock || m.expiringSoon || m.expiredUnits).length;

  return (
    <div className="space-y-4">
      <form onSubmit={(e) => { e.preventDefault(); save(() => saveMedicine(form), () => setForm(blank)); }} className="grid gap-2 rounded-xl border border-border/70 bg-card p-4 sm:grid-cols-4 lg:grid-cols-[1.2fr_1.2fr_0.8fr_0.9fr_0.6fr_0.7fr_0.6fr_auto] lg:items-end">
        <label className="space-y-1 text-xs font-medium">Brand name<Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Dolo 650" className="h-9 rounded-lg" /></label>
        <label className="space-y-1 text-xs font-medium">Generic<Input value={form.genericName} onChange={(e) => setForm((f) => ({ ...f, genericName: e.target.value }))} placeholder="Paracetamol" className="h-9 rounded-lg" /></label>
        <label className="space-y-1 text-xs font-medium">Strength<Input value={form.strength} onChange={(e) => setForm((f) => ({ ...f, strength: e.target.value }))} placeholder="650 mg" className="h-9 rounded-lg" /></label>
        <div className="space-y-1 text-xs font-medium">Form
          <Select value={form.form} onValueChange={(v) => setForm((f) => ({ ...f, form: v }))}>
            <SelectTrigger className="h-9 w-full rounded-lg"><SelectValue /></SelectTrigger>
            <SelectContent>{FORMS.map((x) => <SelectItem key={x} value={x}>{x[0] + x.slice(1).toLowerCase()}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1 text-xs font-medium">Schedule
          <Select value={form.schedule} onValueChange={(v) => setForm((f) => ({ ...f, schedule: v }))}>
            <SelectTrigger className="h-9 w-full rounded-lg"><SelectValue /></SelectTrigger>
            <SelectContent>{["OTC", "H", "H1", "X"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <label className="space-y-1 text-xs font-medium">Price / unit ₹<Input type="number" min="0" step="0.01" value={form.unitPrice} onChange={(e) => setForm((f) => ({ ...f, unitPrice: e.target.value }))} className="h-9 rounded-lg" /></label>
        <label className="space-y-1 text-xs font-medium">GST %<Input type="number" min="0" value={form.gstRate} onChange={(e) => setForm((f) => ({ ...f, gstRate: e.target.value }))} className="h-9 rounded-lg" /></label>
        <Button type="submit" disabled={busy} className="h-9 gap-1.5 rounded-lg"><Plus className="size-4" /> Add</Button>
      </form>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search brand or generic" aria-label="Search medicines" className="h-10 rounded-lg sm:max-w-xs" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyAlerts} onChange={(e) => setOnlyAlerts(e.target.checked)} /> Only low stock / expiring ({alerts})</label>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/70 bg-card">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <tr><th className="w-8" /><th className="px-3 py-2">Medicine</th><th className="px-3 py-2">Form</th><th className="px-3 py-2">Sch.</th><th className="px-3 py-2 text-right">Price</th><th className="px-3 py-2 text-right">In stock</th><th className="px-3 py-2">Nearest expiry</th><th className="px-3 py-2">Alerts</th></tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.map((m) => (
              <Fragment key={m.id}>
                <tr className="cursor-pointer hover:bg-muted/30" onClick={() => setOpen(open === m.id ? null : m.id)}>
                  <td className="px-2 py-2 text-muted-foreground">{open === m.id ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}</td>
                  <td className="px-3 py-2"><div className="font-medium">{m.name}</div><div className="text-xs text-muted-foreground">{m.genericName}{m.strength ? ` · ${m.strength}` : ""}</div></td>
                  <td className="px-3 py-2">{m.form[0] + m.form.slice(1).toLowerCase()}</td>
                  <td className="px-3 py-2">{m.schedule ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{inr(m.unitPrice)}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{m.stockOnHand}</td>
                  <td className="px-3 py-2">{m.nearestExpiry ? fmtDate(m.nearestExpiry) : "—"}</td>
                  <td className="px-3 py-2">
                    <span className="flex flex-wrap gap-1">
                      {m.lowStock && <Chip tone="bad">Low (reorder at {m.reorderLevel})</Chip>}
                      {m.expiringSoon > 0 && <Chip tone="warn">{m.expiringSoon} expire within 90 days</Chip>}
                      {m.expiredUnits > 0 && <Chip tone="bad">{m.expiredUnits} expired — remove</Chip>}
                    </span>
                  </td>
                </tr>
                {open === m.id && (
                  <tr className="bg-muted/20">
                    <td />
                    <td colSpan={7} className="space-y-3 px-3 py-3">
                      {m.batches.length ? (
                        <div className="flex flex-wrap gap-2 text-xs">
                          {m.batches.map((b) => <span key={b.id} className="rounded-md border bg-card px-2 py-1 font-mono">{b.batchNumber} · exp {fmtDate(b.expiryDate)} · {b.quantity}</span>)}
                        </div>
                      ) : <p className="text-xs text-muted-foreground">No stock received yet.</p>}
                      <ReceiveForm medicine={m} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {rows.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">No medicines match.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
