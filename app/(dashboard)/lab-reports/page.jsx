import { redirect } from "next/navigation";
import { guardPage } from "@/lib/guards";
import { getLabResults } from "@/actions/lab";
import { ResultsList } from "@/components/lab/results-list";

export const metadata = { title: "Lab Reports | Smart Hospital" };

export default async function LabReportsPage() {
  const guard = await guardPage("labOrders", "read");
  if (!guard.authorized) redirect(guard.status === 403 ? "/forbidden" : "/sign-in");
  if (guard.role !== "PATIENT") redirect("/lab");
  const res = await getLabResults({});
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Lab Reports</h1>
        <p className="text-sm text-muted-foreground">Your test results once the lab has checked and released them. Values outside the normal range are marked — please discuss them with your doctor.</p>
      </div>
      <ResultsList results={res.success ? res.data : []} empty="You have no lab reports yet." />
    </div>
  );
}
