"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveLabTest } from "@/actions/lab";
import { Chip } from "@/components/inpatient/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatRange } from "@/lib/lab/results";
import { inr } from "@/lib/format";
import { Plus, Trash2 } from "lucide-react";

const blankParam = { name: "", unit: "", low: "", high: "", criticalLow: "", criticalHigh: "" };
const num = (v) => (v === "" || v == null ? undefined : Number(v));

export function TestCatalog({ tests }) {
  const router = useRouter();
  const [t, setT] = useState({ code: "", name: "", department: "LAB", sampleType: "", price: "", turnaroundHours: "" });
  const [params, setParams] = useState([{ ...blankParam }]);
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    const parameters = t.department === "RADIOLOGY" ? [] : params.filter((p) => p.name.trim()).map((p) => ({
      name: p.name.trim(), unit: p.unit.trim(), low: num(p.low), high: num(p.high), criticalLow: num(p.criticalLow), criticalHigh: num(p.criticalHigh),
    }));
    const res = await saveLabTest({ ...t, parameters });
    setBusy(false);
    if (!res.success) return toast.error(res.message);
    toast.success(res.message);
    setT({ code: "", name: "", department: "LAB", sampleType: "", price: "", turnaroundHours: "" });
    setParams([{ ...blankParam }]);
    router.refresh();
  };
  const setP = (i, k, v) => setParams((list) => list.map((p, j) => (j === i ? { ...p, [k]: v } : p)));

  return (
    <div className="space-y-4">
      <form onSubmit={save} className="space-y-3 rounded-xl border border-border/70 bg-card p-4">
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-[1fr_2fr_1fr_1.2fr_0.8fr_0.8fr]">
          <label className="space-y-1 text-xs font-medium">Code<Input value={t.code} onChange={(e) => setT((x) => ({ ...x, code: e.target.value }))} placeholder="LAB-TSH" className="h-9 rounded-lg font-mono" /></label>
          <label className="space-y-1 text-xs font-medium">Name<Input value={t.name} onChange={(e) => setT((x) => ({ ...x, name: e.target.value }))} placeholder="Thyroid stimulating hormone" className="h-9 rounded-lg" /></label>
          <div className="space-y-1 text-xs font-medium">Section
            <Select value={t.department} onValueChange={(v) => setT((x) => ({ ...x, department: v }))}>
              <SelectTrigger className="h-9 w-full rounded-lg"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="LAB">Laboratory</SelectItem><SelectItem value="RADIOLOGY">Radiology / ECG</SelectItem></SelectContent>
            </Select>
          </div>
          <label className="space-y-1 text-xs font-medium">Sample<Input value={t.sampleType} onChange={(e) => setT((x) => ({ ...x, sampleType: e.target.value }))} placeholder="Blood (serum)" className="h-9 rounded-lg" /></label>
          <label className="space-y-1 text-xs font-medium">Price ₹<Input type="number" min="0" value={t.price} onChange={(e) => setT((x) => ({ ...x, price: e.target.value }))} className="h-9 rounded-lg" /></label>
          <label className="space-y-1 text-xs font-medium">Hours<Input type="number" min="0" value={t.turnaroundHours} onChange={(e) => setT((x) => ({ ...x, turnaroundHours: e.target.value }))} className="h-9 rounded-lg" /></label>
        </div>
        {t.department === "LAB" ? (
          <div className="space-y-1.5">
            <div className="text-xs font-medium">Parameters (leave a range blank if it doesn’t apply)</div>
            {params.map((p, i) => (
              <div key={i} className="grid grid-cols-2 gap-1.5 sm:grid-cols-[2fr_1fr_repeat(4,0.8fr)_auto]">
                <Input value={p.name} onChange={(e) => setP(i, "name", e.target.value)} placeholder="Parameter" aria-label="Parameter name" className="h-8 rounded-md" />
                <Input value={p.unit} onChange={(e) => setP(i, "unit", e.target.value)} placeholder="Unit" aria-label="Unit" className="h-8 rounded-md" />
                {[["low", "Normal low"], ["high", "Normal high"], ["criticalLow", "Critical below"], ["criticalHigh", "Critical above"]].map(([k, l]) => (
                  <Input key={k} type="number" step="any" value={p[k]} onChange={(e) => setP(i, k, e.target.value)} placeholder={l} aria-label={l} className="h-8 rounded-md" />
                ))}
                <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Remove parameter" onClick={() => setParams((l) => l.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button>
              </div>
            ))}
            <button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-primary" onClick={() => setParams((l) => [...l, { ...blankParam }])}><Plus className="size-3.5" /> Add parameter</button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Radiology and ECG tests take a written report instead of values.</p>
        )}
        <Button type="submit" disabled={busy} className="h-9 rounded-lg">Add test</Button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-border/70 bg-card">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <tr><th className="px-3 py-2">Test</th><th className="px-3 py-2">Sample</th><th className="px-3 py-2 text-right">Price</th><th className="px-3 py-2">Turnaround</th><th className="px-3 py-2">Parameters and normal ranges</th></tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {tests.map((x) => (
              <tr key={x.id} className="align-top">
                <td className="px-3 py-2"><div className="font-medium">{x.name}</div><div className="font-mono text-xs text-muted-foreground">{x.code}</div>{!x.active && <Chip>Inactive</Chip>}</td>
                <td className="px-3 py-2">{x.department === "RADIOLOGY" ? <Chip tone="info">Radiology</Chip> : x.sampleType}</td>
                <td className="px-3 py-2 text-right tabular-nums">{inr(x.price)}</td>
                <td className="px-3 py-2">{x.turnaroundHours ? `${x.turnaroundHours} h` : "—"}</td>
                <td className="px-3 py-2 text-xs">
                  {(x.parameters ?? []).length === 0 ? <span className="text-muted-foreground">Written report</span> : (
                    <ul className="space-y-0.5">
                      {x.parameters.map((p) => (
                        <li key={p.name}>
                          <span className="font-medium">{p.name}</span> {formatRange(p)} {p.unit}
                          {(p.criticalLow != null || p.criticalHigh != null) && <span className="text-rose-700 dark:text-rose-300"> · critical {p.criticalLow != null ? `< ${p.criticalLow}` : ""}{p.criticalLow != null && p.criticalHigh != null ? " or " : ""}{p.criticalHigh != null ? `> ${p.criticalHigh}` : ""}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
