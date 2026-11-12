"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setDiet } from "@/actions/meals";
import { Panel } from "@/components/inpatient/ui";
import { MealDays } from "@/components/meals/meal-days";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DIET_LABELS } from "@/lib/diet/meals";

function DietForm({ admissionId, current, notes: currentNotes }) {
  const router = useRouter();
  const [dietType, setType] = useState(current);
  const [notes, setNotes] = useState(currentNotes ?? "");
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    const res = await setDiet(admissionId, { dietType, notes });
    setBusy(false);
    if (!res.success) return toast.error(res.message);
    toast.success(res.message);
    router.refresh();
  };
  return (
    <form onSubmit={save} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="space-y-1 text-xs font-medium sm:w-56">Diet order
        <Select value={dietType} onValueChange={setType}>
          <SelectTrigger className="h-9 w-full rounded-lg" aria-label="Diet"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(DIET_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <label className="flex-1 space-y-1 text-xs font-medium">Instructions<Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. 1800 kcal, fluid restriction 1.5 L, nil by mouth from midnight" className="h-9 rounded-lg" /></label>
      <Button type="submit" size="sm" disabled={busy} className="h-9 rounded-lg">Save diet</Button>
    </form>
  );
}

export function DietPanel({ admissionId, meals, canSetDiet, canIntake, admitted }) {
  return (
    <div className="space-y-4">
      {admitted && canSetDiet && <Panel title="Diet order"><DietForm admissionId={admissionId} current={meals.dietType} notes={meals.dietNotes} /></Panel>}
      <Panel title="Meals">
        <MealDays data={meals} canIntake={canIntake && admitted} />
      </Panel>
    </div>
  );
}
