"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getWardsForRoster, getRosterableStaff, getWardRoster, assignToWard, removeAssignment } from "@/actions/roster";
import { Chip } from "@/components/inpatient/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getRoleLabel } from "@/lib/roles";
import { istDateString } from "@/lib/dates";
import { Plus, X } from "lucide-react";

const ROLE_LABEL = { NURSE: "Nurse", WARD_ATTENDANT: "Ward attendant" };

export function RosterBoard() {
  const [wards, setWards] = useState([]);
  const [staff, setStaff] = useState([]);
  const [wardId, setWardId] = useState("");
  const [date, setDate] = useState(istDateString());
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ userId: "", shift: "DAY" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getWardsForRoster().then((res) => { if (res.success) { setWards(res.data); setWardId((id) => id || res.data[0]?.id || ""); } });
    getRosterableStaff().then((res) => { if (res.success) setStaff(res.data); });
  }, []);

  const load = async (ward = wardId, d = date) => {
    if (!ward) return;
    const res = await getWardRoster(ward, d);
    setRows(res.success ? res.data : []);
  };

  useEffect(() => { load(); }, [wardId, date]); // eslint-disable-line react-hooks/exhaustive-deps

  const assign = async (e) => {
    e.preventDefault();
    if (!form.userId) return toast.error("Pick a staff member");
    setBusy(true);
    const res = await assignToWard({ userId: form.userId, wardId, date, shift: form.shift });
    setBusy(false);
    if (!res.success) return toast.error(res.message);
    toast.success(res.message);
    setForm({ userId: "", shift: "DAY" });
    load();
  };

  const remove = async (id) => {
    const res = await removeAssignment(id);
    if (!res.success) return toast.error(res.message);
    toast.success(res.message);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border/70 bg-card p-4">
        <div className="space-y-1 text-xs font-medium">
          Ward
          <Select value={wardId} onValueChange={setWardId}>
            <SelectTrigger className="h-9 w-48 rounded-lg"><SelectValue placeholder="Select ward" /></SelectTrigger>
            <SelectContent>{wards.map((w) => <SelectItem key={w.id} value={w.id}>{w.name} (Floor {w.floor})</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <label className="space-y-1 text-xs font-medium">Date<Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 rounded-lg" /></label>
      </div>

      <form onSubmit={assign} className="grid gap-2 rounded-xl border border-border/70 bg-card p-4 sm:grid-cols-[1fr_140px_auto] sm:items-end">
        <div className="space-y-1 text-xs font-medium">
          Staff
          <Select value={form.userId} onValueChange={(v) => setForm((f) => ({ ...f, userId: v }))}>
            <SelectTrigger className="h-9 rounded-lg"><SelectValue placeholder="Select nurse or ward attendant" /></SelectTrigger>
            <SelectContent>{staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.firstName} {s.lastName} · {ROLE_LABEL[s.role]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1 text-xs font-medium">
          Shift
          <Select value={form.shift} onValueChange={(v) => setForm((f) => ({ ...f, shift: v }))}>
            <SelectTrigger className="h-9 rounded-lg"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="DAY">Day</SelectItem><SelectItem value="NIGHT">Night</SelectItem></SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={busy || !wardId} className="h-9 gap-1.5 rounded-lg"><Plus className="size-4" /> Assign</Button>
      </form>

      <div className="overflow-hidden rounded-xl border border-border/70">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs font-semibold text-muted-foreground">
            <tr><th className="px-3 py-2.5">Staff</th><th className="px-3 py-2.5">Role</th><th className="px-3 py-2.5">Shift</th><th className="px-3 py-2.5" /></tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2 font-medium">{r.staff ? `${r.staff.firstName} ${r.staff.lastName}` : "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.staff ? ROLE_LABEL[r.staff.role] : "—"}</td>
                <td className="px-3 py-2"><Chip tone={r.shift === "DAY" ? "info" : "neutral"}>{r.shift === "DAY" ? "Day" : "Night"}</Chip></td>
                <td className="px-3 py-2 text-right"><Button size="sm" variant="ghost" className="h-7 rounded-lg" onClick={() => remove(r.id)}><X className="size-3.5" /></Button></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="px-3 py-8 text-center text-sm text-muted-foreground">No one is rostered to this ward on this date yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
