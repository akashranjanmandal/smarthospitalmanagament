"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { startPreparing, matchItem, markReady, dispense } from "@/actions/pharmacy";
import { Chip } from "@/components/inpatient/ui";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtTime, fullName, inr } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AlertTriangle, Boxes } from "lucide-react";

const COLUMNS = [
  ["RECEIVED", "New"],
  ["PREPARING", "Being prepared"],
  ["READY", "Ready"],
];

function useRun() {
  const router = useRouter();
  const [busy, setBusy] = useState(null);
  const run = async (key, fn) => {
    setBusy(key);
    const res = await fn();
    setBusy(null);
    if (!res.success) return toast.error(res.message), false;
    toast.success(res.message);
    router.refresh();
    return true;
  };
  return [busy, run];
}

function ItemLine({ item, order, formulary, busy, run }) {
  const [choice, setChoice] = useState("");
  const [reason, setReason] = useState("");
  const editable = order.status !== "READY";
  const stock = formulary.find((m) => m.id === item.medicineId)?.stockOnHand;
  return (
    <li className="space-y-1.5 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium">{item.name} <span className="text-muted-foreground">× {item.quantity}</span></div>
          <div className="text-xs text-muted-foreground">{[item.dose, item.frequency, item.duration].filter(Boolean).join(" · ")}</div>
          {item.substitutedFrom && <div className="text-xs text-amber-800 dark:text-amber-300">Substituted for {item.substitutedFrom}{item.substituteReason ? ` — ${item.substituteReason}` : ""}</div>}
        </div>
        {item.medicineId ? (
          <Chip tone={stock != null && stock < item.quantity ? "bad" : "neutral"}>{stock != null ? `${stock} in stock` : "matched"}</Chip>
        ) : (
          <Chip tone="warn">Not in formulary</Chip>
        )}
      </div>
      {editable && (
        <div className="flex flex-wrap gap-1.5">
          <Select value={choice} onValueChange={setChoice}>
            <SelectTrigger className="h-8 min-w-0 flex-1 rounded-md text-xs" aria-label={`Medicine to give for ${item.name}`}>
              <SelectValue placeholder={item.medicineId ? "Substitute…" : "Choose stocked medicine…"} />
            </SelectTrigger>
            <SelectContent>
              {formulary.map((m) => <SelectItem key={m.id} value={m.id}>{m.name} · {m.genericName} · {m.stockOnHand} left</SelectItem>)}
            </SelectContent>
          </Select>
          {item.medicineId && choice && <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" className="h-8 w-32 rounded-md text-xs" />}
          {choice && (
            <Button size="sm" variant="outline" className="h-8 rounded-md" disabled={busy !== null} onClick={() => run(`m-${item.id}`, () => matchItem(item.id, choice, { reason }))}>Use</Button>
          )}
        </div>
      )}
    </li>
  );
}

function OrderCard({ order, formulary }) {
  const [busy, run] = useRun();
  const [uhid, setUhid] = useState("");
  const p = order.patient;
  const ward = order.admission ? `${order.admission.bed.bedNumber} · ${order.admission.bed.ward.name}` : null;
  const doctor = order.prescription?.doctor?.user;
  return (
    <article className="space-y-2 rounded-xl border border-border/70 bg-card p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-xs font-semibold">{order.orderNumber}</span>
            <Chip tone={order.source === "IPD" ? "info" : "neutral"}>{order.source === "IPD" ? `Ward · ${ward}` : "Out-patient"}</Chip>
          </div>
          <div className="mt-1 font-semibold">{fullName(p)} <span className="font-normal text-muted-foreground tabular-nums">· {p.uhid}</span></div>
          <div className="text-xs text-muted-foreground">{doctor ? `Dr. ${fullName(doctor)} · ` : ""}received {fmtTime(order.createdAt)}</div>
        </div>
        {order.totalAmount != null && <span className="font-semibold tabular-nums">{inr(order.totalAmount)}</span>}
      </div>
      {p.allergies && (
        <div className="flex items-center gap-1.5 rounded-md bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
          <AlertTriangle className="size-3.5" /> Allergies: {p.allergies}
        </div>
      )}
      <ul className="divide-y divide-border/60">
        {order.items.map((item) => <ItemLine key={item.id} item={item} order={order} formulary={formulary} busy={busy} run={run} />)}
      </ul>
      <div className="flex flex-wrap gap-2 pt-1">
        {order.status === "RECEIVED" && <Button size="sm" variant="outline" className="rounded-lg" disabled={busy !== null} onClick={() => run("start", () => startPreparing(order.id))}>Start preparing</Button>}
        {order.status !== "READY" && <Button size="sm" className="rounded-lg" disabled={busy !== null} onClick={() => run("ready", () => markReady(order.id))}>Mark ready</Button>}
        {order.status === "READY" && order.source === "OPD" && (
          <form className="flex w-full gap-2" onSubmit={(e) => { e.preventDefault(); run("give", () => dispense(order.id, { confirmUhid: uhid })); }}>
            <Input value={uhid} onChange={(e) => setUhid(e.target.value)} placeholder="Patient's UHID from slip" aria-label="Confirm patient UHID" className="h-9 flex-1 rounded-lg font-mono text-xs" />
            <Button size="sm" type="submit" className="h-9 rounded-lg" disabled={busy !== null || !uhid}>Hand over</Button>
          </form>
        )}
        {order.status === "READY" && order.source === "IPD" && <Button size="sm" className="rounded-lg" disabled={busy !== null} onClick={() => run("issue", () => dispense(order.id, {}))}>Issue to ward</Button>}
      </div>
    </article>
  );
}

export function PharmacyBoard({ orders, formulary }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 15000);
    return () => clearInterval(t);
  }, [router]);
  const low = formulary.filter((m) => m.lowStock);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pharmacy</h1>
          <p className="text-sm text-muted-foreground">Prescriptions from OPD and medicine indents from wards arrive here automatically.</p>
        </div>
        <Link href="/pharmacy/formulary" className={cn(buttonVariants({ variant: "outline" }), "gap-2 rounded-lg")}>
          <Boxes className="size-4" /> Formulary & stock{low.length ? ` · ${low.length} low` : ""}
        </Link>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {COLUMNS.map(([status, label]) => {
          const list = orders.filter((o) => o.status === status);
          return (
            <section key={status} className="space-y-3 rounded-xl bg-muted/40 p-3">
              <h2 className="flex items-center justify-between text-sm font-semibold">{label} <span className="rounded-md bg-card px-2 py-0.5 text-xs tabular-nums">{list.length}</span></h2>
              {list.length === 0 ? <p className="px-1 text-sm text-muted-foreground">Nothing here.</p> : list.map((o) => <OrderCard key={o.id} order={o} formulary={formulary} />)}
            </section>
          );
        })}
      </div>
    </div>
  );
}
