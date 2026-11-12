import { redirect } from "next/navigation";
import { guardPage } from "@/lib/guards";
import { getLabWorklist } from "@/actions/lab";
import { LabWorklist } from "@/components/lab/lab-worklist";

export const metadata = { title: "Lab & Radiology | Smart Hospital" };

export default async function LabPage() {
  const guard = await guardPage("labOrders", "update");
  if (!guard.authorized) redirect(guard.status === 403 ? "/forbidden" : "/sign-in");
  const res = await getLabWorklist();
  const data = res.success ? res.data : { toCollect: [], inLab: [], toVerify: [], doneToday: [] };
  return <LabWorklist data={data} canResult={["LAB_TECH", "ADMIN", "SUPER_ADMIN"].includes(guard.role)} userId={guard.user.id} />;
}
