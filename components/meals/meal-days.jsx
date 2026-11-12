"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { getMenuFor, placeMealOrder, recordIntake } from "@/actions/meals";
import { Chip } from "@/components/inpatient/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DIET_LABELS } from "@/lib/diet/meals";
import { fmtDate, inr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Leaf, Loader2, Minus, Plus } from "lucide-react";

const INTAKE = { FULL: "Ate all", HALF: "Ate half", LITTLE: "Ate a little", NONE: "Did not eat" };

function dayName(date, i) {
  if (i === 0) return "Today";
  if (i === 1) return "Tomorrow";
  return fmtDate(date);
}

function Picker({ admissionId, date, meal, label, order, onDone }) {
  const router = useRouter();
  const [menu, setMenu] = useState(null);
  const [qty, setQty] = useState(() => Object.fromEntries((order?.items ?? []).filter((i) => i.menuItemId).map((i) => [i.menuItemId, i.quantity])));
  const [notes, setNotes] = useState(order?.notes ?? "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    getMenuFor(admissionId, { date, meal }).then((r) => alive && setMenu(r.success ? r.data.items : []));
    return () => { alive = false; };
  }, [admissionId, date, meal]);

  if (menu === null) {
    return <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading menu…</div>;
  }
  const change = (id, d) => setQty((q) => {
    const n = Math.max(0, Math.min(3, (q[id] ?? 0) + d));
    const next = { ...q };
    if (n) next[id] = n; else delete next[id];
    return next;
  });
  const save = async () => {
    setBusy(true);
    const res = await placeMealOrder(admissionId, { date, meal, items: Object.entries(qty).map(([menuItemId, quantity]) => ({ menuItemId, quantity })), notes });
    setBusy(false);
    if (!res.success) return toast.error(res.message);
    toast.success(res.message);
    onDone();
    router.refresh();
  };
  return (
    <div className="space-y-2 pt-2">
      {menu.length === 0 ? <p className="text-sm text-muted-foreground">No dishes on this menu suit the current diet — the standard meal will be served.</p> : (
        <ul className="divide-y divide-border/60 rounded-lg border">
          {menu.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                  {d.vegetarian ? <Leaf className="size-3.5 text-emerald-600" aria-label="Vegetarian" /> : <span className="size-2.5 rounded-sm bg-rose-600" aria-label="Non-vegetarian" />}
                  {d.name}
                  {d.isExtra && <Chip tone="warn">Extra · {inr(d.price)}</Chip>}
                </div>
                {d.description && <div className="text-xs text-muted-foreground">{d.description}</div>}
              </div>
              <div className="flex items-center gap-1">
                <Button type="button" size="icon" variant="outline" className="size-8" aria-label={`Less ${d.name}`} onClick={() => change(d.id, -1)} disabled={!qty[d.id]}><Minus className="size-3.5" /></Button>
                <span className="w-5 text-center text-sm tabular-nums">{qty[d.id] ?? 0}</span>
                <Button type="button" size="icon" variant="outline" className="size-8" aria-label={`More ${d.name}`} onClick={() => change(d.id, 1)}><Plus className="size-3.5" /></Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Note for the kitchen (e.g. less spicy, no onion)" className="h-9 rounded-lg" />
        <Button size="sm" className="h-9 rounded-lg" disabled={busy || !Object.keys(qty).length} onClick={save}>Save {label.toLowerCase()}</Button>
        <Button size="sm" variant="ghost" className="h-9 rounded-lg" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  );
}

function MealRow({ m, date, admissionId, canIntake }) {
  const router = useRouter();
  const [picking, setPicking] = useState(false);
  const o = m.order;
  const delivered = o?.status === "DELIVERED";
  const saveIntake = async (v) => {
    const res = await recordIntake(o.id, v);
    if (!res.success) return toast.error(res.message);
    toast.success(res.message);
    router.refresh();
  };
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold">{m.label} <span className="font-normal text-muted-foreground">· served {m.serve}</span></div>
          <div className="text-sm">
            {o ? o.items.map((i) => `${i.quantity > 1 ? `${i.quantity} × ` : ""}${i.name}`).join(", ") : <span className="text-muted-foreground">Nothing chosen — the standard meal for the diet will be served</span>}
          </div>
          {o?.notes && <div className="text-xs text-muted-foreground">Note: {o.notes}</div>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {delivered ? <Chip tone="good">Delivered</Chip> : m.open ? <Chip tone="info">Order by {m.cutoffText}</Chip> : <Chip>Ordering closed</Chip>}
          {o?.intake && <Chip>{INTAKE[o.intake]}</Chip>}
          {m.open && !delivered && !picking && <Button size="sm" variant="outline" className="h-8 rounded-lg" onClick={() => setPicking(true)}>{o ? "Change" : "Choose"}</Button>}
        </div>
      </div>
      {canIntake && delivered && !o.intake && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="self-center text-xs text-muted-foreground">How much was eaten?</span>
          {Object.entries(INTAKE).map(([k, l]) => <Button key={k} size="sm" variant="outline" className="h-7 rounded-md px-2 text-xs" onClick={() => saveIntake(k)}>{l}</Button>)}
        </div>
      )}
      {picking && <Picker admissionId={admissionId} date={date} meal={m.meal} label={m.label} order={o} onDone={() => setPicking(false)} />}
    </li>
  );
}

/** Today and the next two days of meals for one stay. */
export function MealDays({ data, canIntake = false }) {
  const [day, setDay] = useState(0);
  const nbm = data.dietType === "NIL_BY_MOUTH";
  const current = data.days[day];
  return (
    <div className="space-y-3">
      <div className={cn("rounded-lg border px-3 py-2 text-sm", nbm ? "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200" : "bg-muted/40")}>
        <span className="font-semibold">Diet: {DIET_LABELS[data.dietType]}</span>
        {data.dietNotes ? ` — ${data.dietNotes}` : ""}
        {nbm && " · No food or drink until the doctor changes this."}
      </div>
      {!nbm && (
        <>
          <div className="flex gap-1 rounded-lg bg-muted p-1 text-sm" role="tablist" aria-label="Day">
            {data.days.map((d, i) => (
              <button key={d.date} type="button" role="tab" aria-selected={day === i} onClick={() => setDay(i)} className={cn("flex-1 rounded-md px-3 py-1.5", day === i ? "bg-card font-semibold shadow-sm" : "text-muted-foreground")}>{dayName(d.date, i)}</button>
            ))}
          </div>
          <ul className="divide-y divide-border/60">
            {current.meals.map((m) => <MealRow key={`${current.date}-${m.meal}`} m={m} date={current.date} admissionId={data.admissionId} canIntake={canIntake} />)}
          </ul>
        </>
      )}
    </div>
  );
}
