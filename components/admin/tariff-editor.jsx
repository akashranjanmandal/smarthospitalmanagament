"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveTariff } from "@/actions/ipd-billing";
import { Chip } from "@/components/inpatient/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORY_LABELS, inr } from "@/lib/format";
import { Pencil, Plus } from "lucide-react";

const blank = { code: "", name: "", category: "LAB", price: "", gstRate: "0", active: true };

function CategorySelect({ value, onChange, includeAll }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-full rounded-lg"><SelectValue /></SelectTrigger>
      <SelectContent>
        {includeAll && <SelectItem value="all">All categories</SelectItem>}
        {Object.entries(CATEGORY_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export function TariffEditor({ tariffs }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return tariffs.filter((t) => (category === "all" || t.category === category) && (!s || t.name.toLowerCase().includes(s) || t.code.toLowerCase().includes(s)));
  }, [tariffs, q, category]);

  const save = async (data, after) => {
    setBusy(true);
    const res = await saveTariff(data);
    setBusy(false);
    if (!res.success) return toast.error(res.message);
    toast.success(res.message);
    after?.();
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <form onSubmit={(e) => { e.preventDefault(); save(form, () => setForm(blank)); }} className="grid gap-2 rounded-xl border border-border/70 bg-card p-4 sm:grid-cols-[140px_1fr_170px_110px_90px_auto] sm:items-end">
        <label className="space-y-1 text-xs font-medium">Code<Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="LAB-HBA1C" className="h-9 rounded-lg font-mono" /></label>
        <label className="space-y-1 text-xs font-medium">Name<Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="HbA1c" className="h-9 rounded-lg" /></label>
        <div className="space-y-1 text-xs font-medium">Category<CategorySelect value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v }))} /></div>
        <label className="space-y-1 text-xs font-medium">Price ₹<Input type="number" min="0" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} className="h-9 rounded-lg" /></label>
        <label className="space-y-1 text-xs font-medium">GST %<Input type="number" min="0" value={form.gstRate} onChange={(e) => setForm((f) => ({ ...f, gstRate: e.target.value }))} className="h-9 rounded-lg" /></label>
        <Button type="submit" disabled={busy} className="h-9 gap-1.5 rounded-lg"><Plus className="size-4" /> Add</Button>
      </form>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code or name" className="h-10 rounded-lg sm:max-w-xs" aria-label="Search tariffs" />
        <div className="sm:w-52"><CategorySelect value={category} onChange={setCategory} includeAll /></div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/70 bg-card">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <tr><th className="px-3 py-2">Code</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">Category</th><th className="px-3 py-2 text-right">Price</th><th className="px-3 py-2 text-right">GST</th><th className="px-3 py-2">Status</th><th className="w-24" /></tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.map((t) =>
              editing?.id === t.id ? (
                <tr key={t.id} className="bg-muted/30">
                  <td className="px-3 py-2"><Input value={editing.code} onChange={(e) => setEditing((x) => ({ ...x, code: e.target.value }))} className="h-8 rounded-md font-mono" /></td>
                  <td className="px-3 py-2"><Input value={editing.name} onChange={(e) => setEditing((x) => ({ ...x, name: e.target.value }))} className="h-8 rounded-md" /></td>
                  <td className="px-3 py-2"><CategorySelect value={editing.category} onChange={(v) => setEditing((x) => ({ ...x, category: v }))} /></td>
                  <td className="px-3 py-2"><Input type="number" value={editing.price} onChange={(e) => setEditing((x) => ({ ...x, price: e.target.value }))} className="h-8 rounded-md text-right" /></td>
                  <td className="px-3 py-2"><Input type="number" value={editing.gstRate} onChange={(e) => setEditing((x) => ({ ...x, gstRate: e.target.value }))} className="h-8 rounded-md text-right" /></td>
                  <td className="px-3 py-2"><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={editing.active} onChange={(e) => setEditing((x) => ({ ...x, active: e.target.checked }))} /> Active</label></td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" className="h-8 rounded-md" disabled={busy} onClick={() => save(editing, () => setEditing(null))}>Save</Button>
                      <Button size="sm" variant="ghost" className="h-8 rounded-md" onClick={() => setEditing(null)}>Cancel</Button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={t.id} className={t.active ? "" : "text-muted-foreground"}>
                  <td className="px-3 py-2 font-mono text-xs">{t.code}</td>
                  <td className="px-3 py-2 font-medium">{t.name}</td>
                  <td className="px-3 py-2">{CATEGORY_LABELS[t.category]}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{inr(t.price)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{t.gstRate ? `${t.gstRate}%` : "—"}</td>
                  <td className="px-3 py-2">{t.active ? <Chip tone="good">Active</Chip> : <Chip>Inactive</Chip>}</td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant="ghost" className="h-8 gap-1 rounded-md" onClick={() => setEditing({ ...t, price: String(t.price), gstRate: String(t.gstRate) })}><Pencil className="size-3.5" /> Edit</Button>
                  </td>
                </tr>
              )
            )}
            {rows.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No tariffs match.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
