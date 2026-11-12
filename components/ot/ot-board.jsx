"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { scheduleOT } from "@/actions/ot";
import { Chip } from "@/components/inpatient/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fullName, fmtDateTime } from "@/lib/format";
import { Plus } from "lucide-react";

const STATUS_TONE = { SCHEDULED: "info", IN_PROGRESS: "warn", COMPLETED: "good", CANCELLED: "neutral" };
const STATUS_LABEL = { SCHEDULED: "Scheduled", IN_PROGRESS: "In progress", COMPLETED: "Completed", CANCELLED: "Cancelled" };

export function OTBoard({ bookings, admissions, doctors, canSchedule, initialAdmissionId }) {
  const router = useRouter();
  const [open, setOpen] = useState(!!initialAdmissionId);
  const [form, setForm] = useState({ admissionId: initialAdmissionId || "", procedureName: "", surgeonId: "", theatre: "", scheduledAt: "" });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const res = await scheduleOT(form);
    setBusy(false);
    if (!res.success) return toast.error(res.message);
    toast.success(res.message);
    setOpen(false);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      {canSchedule && (
        open ? (
          <form onSubmit={submit} className="grid gap-2 rounded-xl border border-border/70 bg-card p-4 sm:grid-cols-2">
            <div className="space-y-1 text-xs font-medium">
              Patient (admitted)
              <Select value={form.admissionId} onValueChange={(v) => setForm((f) => ({ ...f, admissionId: v }))}>
                <SelectTrigger className="h-9 rounded-lg"><SelectValue placeholder="Select admission" /></SelectTrigger>
                <SelectContent>{admissions.map((a) => <SelectItem key={a.id} value={a.id}>{fullName(a.patient)} · {a.bed.bedNumber} · {a.admissionNumber}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1 text-xs font-medium">
              Surgeon
              <Select value={form.surgeonId} onValueChange={(v) => setForm((f) => ({ ...f, surgeonId: v }))}>
                <SelectTrigger className="h-9 rounded-lg"><SelectValue placeholder="Select surgeon" /></SelectTrigger>
                <SelectContent>{doctors.map((d) => <SelectItem key={d.id} value={d.id}>Dr. {d.firstName} {d.lastName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <label className="space-y-1 text-xs font-medium">Procedure<Input value={form.procedureName} onChange={(e) => setForm((f) => ({ ...f, procedureName: e.target.value }))} placeholder="e.g. Appendectomy" className="h-9 rounded-lg" /></label>
            <label className="space-y-1 text-xs font-medium">Theatre<Input value={form.theatre} onChange={(e) => setForm((f) => ({ ...f, theatre: e.target.value }))} placeholder="OT-1" className="h-9 rounded-lg" /></label>
            <label className="space-y-1 text-xs font-medium sm:col-span-2">Date & time<Input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))} className="h-9 rounded-lg" /></label>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" disabled={busy} className="h-9 rounded-lg">Schedule</Button>
              <Button type="button" variant="outline" className="h-9 rounded-lg" onClick={() => setOpen(false)}>Cancel</Button>
            </div>
          </form>
        ) : (
          <Button onClick={() => setOpen(true)} className="gap-1.5 rounded-lg"><Plus className="size-4" /> Schedule a procedure</Button>
        )
      )}

      <div className="overflow-hidden rounded-xl border border-border/70">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs font-semibold text-muted-foreground">
            <tr><th className="px-3 py-2.5">Time</th><th className="px-3 py-2.5">Patient</th><th className="px-3 py-2.5">Procedure</th><th className="px-3 py-2.5">Theatre</th><th className="px-3 py-2.5">Surgeon</th><th className="px-3 py-2.5">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {bookings.map((b) => (
              <tr key={b.id}>
                <td className="px-3 py-2 tabular-nums">{fmtDateTime(b.scheduledAt)}</td>
                <td className="px-3 py-2"><Link href={`/ot/${b.id}`} className="font-semibold text-primary hover:underline">{fullName(b.admission.patient)}</Link> <span className="text-xs text-muted-foreground">{b.admission.patient.uhid}</span></td>
                <td className="px-3 py-2">{b.procedureName}</td>
                <td className="px-3 py-2">{b.theatre}</td>
                <td className="px-3 py-2">Dr. {b.surgeon.user.firstName} {b.surgeon.user.lastName}</td>
                <td className="px-3 py-2"><Chip tone={STATUS_TONE[b.status]}>{STATUS_LABEL[b.status]}</Chip></td>
              </tr>
            ))}
            {bookings.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-muted-foreground">No procedures scheduled for today.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
