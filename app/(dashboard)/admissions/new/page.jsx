import { redirect } from "next/navigation";
import { guardPage } from "@/lib/guards";
import { canUpdate } from "@/lib/permissions";
import { getAdmitFormOptions } from "@/actions/admissions";
import { AdmitForm } from "@/components/inpatient/admit-form";

export const metadata = { title: "Admit Patient | Smart Hospital" };

export default async function AdmitPatientPage({ searchParams }) {
  const guard = await guardPage("admissions", "create");
  if (!guard.authorized) redirect(guard.status === 403 ? "/forbidden" : "/sign-in");
  const params = await searchParams;
  const result = await getAdmitFormOptions();
  const options = result.success ? result.data : { beds: [], patients: [], departments: [], doctors: [] };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admit Patient</h1>
        <p className="text-sm text-muted-foreground">Allot a bed, admitting department and attending doctor. The bed board updates immediately.</p>
      </div>
      <AdmitForm options={options} initialBedId={params.bedId ?? ""} initialPatientId={params.patientId ?? ""} canSetPayer={canUpdate("insurance", guard.role)} />
    </div>
  );
}
