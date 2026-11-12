"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveMenuItem } from "@/actions/meals";
import { Chip, Panel } from "@/components/inpatient/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MEALS, DIET_LABELS } from "@/lib/diet/meals";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";

const DIETS = Object.keys(DIET_LABELS).filter((d) => d !== "NIL_BY_MOUTH");
const blank = { name: "", meal: "LUNCH", diets: ["NORMAL"], vegetarian: true, isExtra: false, price: "", description: "" };

function DishForm({ initial, onDone, submitLabel }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const toggle = (d) => setV((x) => ({ ...x, diets: x.diets.includes(d) ? x.diets.filter((y) => y !== d) : [...x.diets, d] }));
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    const res = await saveMenuItem(v);
    setBusy(false);
    if (!res.success) return toast.error(res.message);
    toast.success(res.message);
    onDone?.();
    router.refresh();
  };
  return (
    <form onSubmit={save} className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
        <label className="space-y-1 text-xs font-medium">Dish<Input value={v.name} onChange={(e) => setV((x) => ({ ...x, name: e.target.value }))} placeholder="Vegetable pulao" className="h-9 rounded-lg" /></label>
        <div className="space-y-1 text-xs font-medium">Meal
          <Select value={v.meal} onValueChange={(m) => setV((x) => ({ ...x, meal: m }))}>
            <SelectTrigger className="h-9 w-full rounded-lg"><SelectValue /></SelectTrigger>
            <SelectContent>{MEALS.map((m) => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <label className="space-y-1 text-xs font-medium">Description<Input value={v.description ?? ""} onChange={(e) => setV((x) => ({ ...x, description: e.target.value }))} className="h-9 rounded-lg" /></label>
        <div className="flex gap-3 pb-2 text-sm">
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={v.vegetarian} onChange={(e) => setV((x) => ({ ...x, vegetarian: e.target.checked }))} /> Veg</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={v.isExtra} onChange={(e) => setV((x) => ({ ...x, isExtra: e.target.checked }))} /> Extra</label>
        </div>
      </div>
      <fieldset className="flex flex-wrap gap-1.5">
        <legend className="mb-1 text-xs font-medium">Suitable for</legend>
        {DIETS.map((d) => (
          <button key={d} type="button" aria-pressed={v.diets.includes(d)} onClick={() => toggle(d)} className={cn("rounded-md border px-2 py-1 text-xs", v.diets.includes(d) ? "border-primary bg-primary/10 font-semibold text-primary" : "text-muted-foreground")}>{DIET_LABELS[d]}</button>
        ))}
      </fieldset>
      <div className="flex flex-wrap items-end gap-2">
        {v.isExtra && <label className="space-y-1 text-xs font-medium">Price ₹<Input type="number" min="1" value={v.price} onChange={(e) => setV((x) => ({ ...x, price: e.target.value }))} className="h-9 w-28 rounded-lg" /></label>}
        <Button type="submit" size="sm" disabled={busy} className="h-9 rounded-lg">{submitLabel}</Button>
        {onDone && <Button type="button" variant="ghost" size="sm" className="h-9" onClick={onDone}>Cancel</Button>}
      </div>
    </form>
  );
}

export function MenuEditor({ items }) {
  const [editing, setEditing] = useState(null);
  return (
    <div className="space-y-4">
      <Panel title="Add a dish"><DishForm initial={blank} submitLabel="Add dish" /></Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        {MEALS.map((m) => (
          <Panel key={m.key} title={`${m.label} · served ${m.serve}, order by ${m.cutoffDayBefore ? "previous evening " : ""}${m.cutoff}`} bodyClassName="p-0">
            <ul className="divide-y divide-border/60">
              {items.filter((i) => i.meal === m.key).map((i) => (
                <li key={i.id} className="px-4 py-2.5">
                  {editing === i.id ? (
                    <DishForm initial={{ ...i, price: String(i.price) }} submitLabel="Save" onDone={() => setEditing(null)} />
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <div className={cn("min-w-0", !i.active && "opacity-60")}>
                        <div className="text-sm font-medium">{i.name} {!i.vegetarian && <Chip tone="bad">Non-veg</Chip>} {i.isExtra && <Chip tone="warn">Extra · {inr(i.price)}</Chip>} {!i.active && <Chip>Off menu</Chip>}</div>
                        <div className="text-xs text-muted-foreground">{i.diets.map((d) => DIET_LABELS[d]).join(", ")}</div>
                      </div>
                      <Button size="sm" variant="ghost" className="h-7 rounded-md text-xs" onClick={() => setEditing(i.id)}>Edit</Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>
    </div>
  );
}
