"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createBranch, updateBranch } from "@/actions/branches";
import { Chip } from "@/components/inpatient/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";

const blank = { name: "", city: "", address: "", phone: "" };

export function BranchManager({ branches, canManage = false }) {
  const router = useRouter();
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    const res = await createBranch(form);
    setBusy(false);
    if (!res.success) return toast.error(res.message);
    toast.success(`${res.data.name} added (code ${res.data.code})`);
    setForm(blank);
    router.refresh();
  };

  const toggleStatus = async (branch) => {
    const res = await updateBranch(branch.id, { status: branch.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" });
    if (!res.success) return toast.error(res.message);
    toast.success(res.message);
    router.refresh();
  };

  const saveEdit = async (branch) => {
    const res = await updateBranch(branch.id, { name: editing.name, city: editing.city, address: editing.address, phone: editing.phone });
    if (!res.success) return toast.error(res.message);
    toast.success(res.message);
    setEditing(null);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      {canManage && (
        <form onSubmit={create} className="grid gap-2 rounded-xl border border-border/70 bg-card p-4 sm:grid-cols-[1fr_1fr_1fr_140px_auto] sm:items-end">
          <label className="space-y-1 text-xs font-medium">Name<Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Koramangala" className="h-9 rounded-lg" /></label>
          <label className="space-y-1 text-xs font-medium">City<Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} placeholder="Bengaluru" className="h-9 rounded-lg" /></label>
          <label className="space-y-1 text-xs font-medium">Address<Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} className="h-9 rounded-lg" /></label>
          <label className="space-y-1 text-xs font-medium">Phone<Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="h-9 rounded-lg" /></label>
          <Button type="submit" disabled={busy} className="h-9 gap-1.5 rounded-lg"><Plus className="size-4" /> Add branch</Button>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-border/70">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs font-semibold text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5">Branch</th>
              <th className="px-3 py-2.5">Code</th>
              <th className="px-3 py-2.5">City</th>
              <th className="px-3 py-2.5">Staff</th>
              <th className="px-3 py-2.5">Departments</th>
              <th className="px-3 py-2.5">Status</th>
              {canManage && <th className="px-3 py-2.5" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {branches.map((b) => (
              <tr key={b.id}>
                {canManage && editing?.id === b.id ? (
                  <>
                    <td className="px-3 py-2"><Input value={editing.name} onChange={(e) => setEditing((f) => ({ ...f, name: e.target.value }))} className="h-8 rounded-lg" /></td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{b.code}</td>
                    <td className="px-3 py-2"><Input value={editing.city ?? ""} onChange={(e) => setEditing((f) => ({ ...f, city: e.target.value }))} className="h-8 rounded-lg" /></td>
                    <td className="px-3 py-2 text-muted-foreground">{b._count.staff}</td>
                    <td className="px-3 py-2 text-muted-foreground">{b._count.departments}</td>
                    <td className="px-3 py-2"><Chip tone={b.status === "ACTIVE" ? "good" : "neutral"}>{b.status}</Chip></td>
                    <td className="px-3 py-2 text-right">
                      <Button size="sm" className="h-7 rounded-lg" onClick={() => saveEdit(b)}>Save</Button>
                      <Button size="sm" variant="ghost" className="h-7 rounded-lg" onClick={() => setEditing(null)}>Cancel</Button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-3 py-2 font-medium">{b.name}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{b.code}</td>
                    <td className="px-3 py-2 text-muted-foreground">{b.city || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{b._count.staff}</td>
                    <td className="px-3 py-2 text-muted-foreground">{b._count.departments}</td>
                    <td className="px-3 py-2"><Chip tone={b.status === "ACTIVE" ? "good" : "neutral"}>{b.status}</Chip></td>
                    {canManage && (
                      <td className="px-3 py-2 text-right">
                        <Button size="sm" variant="ghost" className="h-7 rounded-lg" onClick={() => setEditing({ id: b.id, name: b.name, city: b.city, address: b.address, phone: b.phone })}>Edit</Button>
                        <Button size="sm" variant="ghost" className="h-7 rounded-lg" onClick={() => toggleStatus(b)}>{b.status === "ACTIVE" ? "Deactivate" : "Activate"}</Button>
                      </td>
                    )}
                  </>
                )}
              </tr>
            ))}
            {branches.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground">No branches yet. Add the first one above.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
