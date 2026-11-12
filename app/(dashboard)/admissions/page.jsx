import Link from "next/link";
import { redirect } from "next/navigation";
import { guardPage } from "@/lib/guards";
import { canCreate } from "@/lib/permissions";
import { getAdmissions } from "@/actions/admissions";
import { prisma } from "@/lib/prisma";
import { AdmissionsFilters } from "@/components/inpatient/admissions-filters";
import { Chip, VitalFlags } from "@/components/inpatient/ui";
import { buttonVariants } from "@/components/ui/button";
import { fmtDateTime, fmtDate, ageSex, fullName } from "@/lib/format";
import { lengthOfStayDays } from "@/lib/identifiers";
import { cn } from "@/lib/utils";
import { BedDouble, Plus } from "lucide-react";

export const metadata = { title: "In-Patients | Smart Hospital" };

export default async function AdmissionsPage({ searchParams }) {
  const guard = await guardPage("admissions", "read");
  if (!guard.authorized) redirect(guard.status === 403 ? "/forbidden" : "/sign-in");

  const params = await searchParams;
  const isPatient = guard.role === "PATIENT";
  const status = params.status ?? (isPatient ? "all" : "ADMITTED");
  const [result, wards] = await Promise.all([
    getAdmissions({ status, search: params.q, wardId: params.ward }),
    isPatient ? [] : prisma.ward.findMany({ select: { id: true, name: true }, orderBy: [{ floor: "asc" }, { name: "asc" }] }),
  ]);
  const admissions = result.success ? result.data : [];
  const canAdmit = canCreate("admissions", guard.role);

  if (isPatient) return <PatientStays admissions={admissions} />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">In-Patients</h1>
          <p className="text-sm text-muted-foreground">
            {status === "ADMITTED" ? `${admissions.length} patient${admissions.length === 1 ? "" : "s"} currently admitted` : `${admissions.length} admission records`}
          </p>
        </div>
        {canAdmit && (
          <Link href="/admissions/new" className={cn(buttonVariants(), "gap-2 rounded-lg")}>
            <Plus className="size-4" /> Admit patient
          </Link>
        )}
      </div>

      <AdmissionsFilters wards={wards} status={status} />

      {admissions.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          {params.q ? "No admissions match your search." : status === "ADMITTED" ? "No patients are admitted right now." : "No admissions found."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/70 bg-card">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="border-b bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Bed</th>
                <th className="px-4 py-2.5">Patient</th>
                <th className="px-4 py-2.5">Admission</th>
                <th className="px-4 py-2.5">Doctor / Department</th>
                <th className="px-4 py-2.5">Latest vitals</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {admissions.map((a) => (
                <tr key={a.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 align-top">
                    <div className="font-bold">{a.bed.bedNumber}</div>
                    <div className="text-xs text-muted-foreground">{a.bed.ward.name}</div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <Link href={`/admissions/${a.id}`} className="font-semibold text-primary hover:underline">{fullName(a.patient)}</Link>
                    <div className="text-xs text-muted-foreground tabular-nums">{a.patient.uhid} · {ageSex(a.patient)}</div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="font-medium tabular-nums">{a.admissionNumber}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.status === "ADMITTED" ? `Day ${lengthOfStayDays(a.admittedAt)} · since ${fmtDate(a.admittedAt)}` : `Discharged ${fmtDate(a.dischargedAt)}`}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div>Dr. {fullName(a.doctor.user)}</div>
                    <div className="text-xs text-muted-foreground">{a.department.name}</div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    {a.latestVitals ? (
                      <div className="space-y-1">
                        <VitalFlags flags={a.latestVitals.flags} empty={<Chip tone="good">Within range</Chip>} />
                        <div className="text-xs text-muted-foreground">{fmtDateTime(a.latestVitals.recordedAt)}</div>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not charted yet</span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <Chip tone={a.status === "ADMITTED" ? "info" : "neutral"}>{a.status === "ADMITTED" ? "Admitted" : "Discharged"}</Chip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PatientStays({ admissions }) {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Hospital Stays</h1>
        <p className="text-sm text-muted-foreground">Your admissions and discharge summaries, at every hospital in our network.</p>
      </div>
      {admissions.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">You have no hospital stays on record.</div>
      ) : (
        <ul className="space-y-3">
          {admissions.map((a) => (
            <li key={a.id} className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{a.department.name} · Dr. {fullName(a.doctor.user)}</div>
                  <div className="text-sm text-muted-foreground">
                    {fmtDate(a.admittedAt)} – {a.dischargedAt ? fmtDate(a.dischargedAt) : "now"} · {a.admissionNumber}
                  </div>
                </div>
                <Chip tone={a.status === "ADMITTED" ? "info" : "good"}>{a.status === "ADMITTED" ? `In hospital · bed ${a.bed.bedNumber}` : "Discharged"}</Chip>
              </div>
              <div className="mt-3 flex gap-2">
                {a.status === "DISCHARGED" ? (
                  <Link href={`/admissions/${a.id}/summary`} className={cn(buttonVariants({ size: "sm" }), "rounded-lg")}>View discharge summary</Link>
                ) : (
                  <Link href={`/admissions/${a.id}`} className={cn(buttonVariants({ size: "sm", variant: "outline" }), "gap-1.5 rounded-lg")}>
                    <BedDouble className="size-4" /> View my stay
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
