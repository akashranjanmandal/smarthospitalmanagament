import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { guardPage } from "@/lib/guards";
import { canUpdate } from "@/lib/permissions";
import { getOTBooking } from "@/actions/ot";
import { OTChecklist } from "@/components/ot/ot-checklist";
import { Chip, Field } from "@/components/inpatient/ui";
import { fullName, fmtDateTime } from "@/lib/format";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Procedure | Smart Hospital" };

const STATUS_TONE = { SCHEDULED: "info", IN_PROGRESS: "warn", COMPLETED: "good", CANCELLED: "neutral" };

export default async function OTBookingPage({ params }) {
  const guard = await guardPage("ot", "read");
  if (!guard.authorized) redirect(guard.status === 403 ? "/forbidden" : "/sign-in");
  const { id } = await params;
  const res = await getOTBooking(id);
  if (!res.success) notFound();
  const b = res.data;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/ot" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Operation theatre
      </Link>

      <section className="rounded-xl border border-border/70 bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight">{b.procedureName}</h1>
          <Chip tone={STATUS_TONE[b.status]}>{b.status.replace("_", " ")}</Chip>
        </div>
        <p className="text-sm text-muted-foreground">
          <Link href={`/admissions/${b.admissionId}`} className="font-semibold text-primary hover:underline">{fullName(b.admission.patient)}</Link>
          {" "}· {b.admission.patient.uhid} · {b.admission.admissionNumber}
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
          <Field label="Surgeon">Dr. {b.surgeon.user.firstName} {b.surgeon.user.lastName}</Field>
          <Field label="Theatre">{b.theatre}</Field>
          <Field label="Scheduled">{fmtDateTime(b.scheduledAt)}</Field>
          {b.admission.patient.allergies && <Field label="Allergies" className="col-span-2">{b.admission.patient.allergies}</Field>}
        </dl>
      </section>

      <OTChecklist booking={b} canAct={canUpdate("ot", guard.role)} />
    </div>
  );
}
