import { redirect } from "next/navigation";
import { guardPage } from "@/lib/guards";
import { getBranches } from "@/actions/branches";
import { BranchManager } from "@/components/admin/branch-manager";

export const metadata = { title: "Branches | Smart Hospital" };

export default async function BranchesPage() {
  const guard = await guardPage("branches", "read");
  if (!guard.authorized) redirect(guard.status === 403 ? "/forbidden" : "/sign-in");
  const res = await getBranches();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Branches</h1>
        <p className="text-sm text-muted-foreground">Every hospital in the chain. Staff, departments, wards and beds each belong to one branch; patients and their UHID follow them to any branch.</p>
      </div>
      <BranchManager branches={res.success ? res.data : []} canManage={guard.role === "SUPER_ADMIN"} />
    </div>
  );
}
