import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { guardPage } from "@/lib/guards";
import { getAdmission } from "@/actions/admissions";
import { ShareSummary } from "@/components/inpatient/share-summary";
import { fmtDate, fmtDateTime, ageSex, fullName, CONDITION_LABELS } from "@/lib/format";
import { lengthOfStayDays } from "@/lib/identifiers";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Discharge Summary | Smart Hospital" };

const HOSPITAL_NAME = process.env.NEXT_PUBLIC_HOSPITAL_NAME || "Smart Hospital";

/** Plain-text version for WhatsApp and email. */
function summaryText(a, meds) {
  const lines = [
    `${HOSPITAL_NAME} — Discharge summary`,
    `${fullName(a.patient)} (${a.patient.uhid})`,
    `Stay: ${fmtDate(a.admittedAt)} to ${fmtDate(a.dischargedAt)} (${a.admissionNumber})`,
    `Doctor: Dr. ${fullName(a.doctor.user)}, ${a.department.name}`,
    "",
    `What you had: ${a.finalDiagnosis}`,
  ];
  if (meds.length) {
    lines.push("", "Your medicines:");
    meds.forEach((m) => lines.push(`• ${[m.name, m.dose, m.frequency, m.duration].filter(Boolean).join(" — ")}`));
  }
  if (a.dischargeAdvice) lines.push("", `At home: ${a.dischargeAdvice}`);
  if (a.followUpDate) lines.push("", `Next visit: ${fmtDate(a.followUpDate)} with Dr. ${fullName(a.doctor.user)}`);
  if (a.warningSigns) lines.push("", `Come to hospital immediately if: ${a.warningSigns}`);
  return lines.join("\n");
}

export default async function DischargeSummaryPage({ params }) {
  const guard = await guardPage("admissions", "read");
  if (!guard.authorized) redirect(guard.status === 403 ? "/forbidden" : "/sign-in");
  const { id } = await params;
  const result = await getAdmission(id);
  if (!result.success) notFound();
  const a = result.data;
  if (a.status !== "DISCHARGED") redirect(`/admissions/${a.id}`);
  const meds = Array.isArray(a.dischargeMedications) ? a.dischargeMedications : [];
  const email = a.patient.user?.email && !a.patient.user.email.endsWith("@phone.local") ? a.patient.user.email : null;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={guard.role === "PATIENT" ? "/admissions" : `/admissions/${a.id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back
        </Link>
        <ShareSummary text={summaryText(a, meds)} phone={a.patient.phone} email={email} />
      </div>

      <article className="rounded-xl border bg-card p-6 text-[15px] leading-relaxed sm:p-8 print:border-0 print:p-0">
        <header className="border-b pb-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">{HOSPITAL_NAME}</p>
          <h1 className="mt-1 text-2xl font-bold">Discharge Summary</h1>
          <p className="mt-1 text-sm text-muted-foreground tabular-nums">{a.admissionNumber} · Printed {fmtDateTime(new Date())}</p>
        </header>

        <section className="grid grid-cols-2 gap-x-6 gap-y-2 border-b py-4 text-sm sm:grid-cols-3">
          <div><span className="text-muted-foreground">Patient</span><div className="font-semibold">{fullName(a.patient)}</div></div>
          <div><span className="text-muted-foreground">UHID</span><div className="font-semibold tabular-nums">{a.patient.uhid}</div></div>
          <div><span className="text-muted-foreground">Age / Sex</span><div className="font-semibold">{ageSex(a.patient)}</div></div>
          <div><span className="text-muted-foreground">Admitted</span><div className="font-semibold">{fmtDate(a.admittedAt)}</div></div>
          <div><span className="text-muted-foreground">Discharged</span><div className="font-semibold">{fmtDate(a.dischargedAt)}</div></div>
          <div><span className="text-muted-foreground">Days in hospital</span><div className="font-semibold">{lengthOfStayDays(a.admittedAt, a.dischargedAt)}</div></div>
          <div className="col-span-2 sm:col-span-3"><span className="text-muted-foreground">Your doctor</span><div className="font-semibold">Dr. {fullName(a.doctor.user)} · {a.department.name}</div></div>
        </section>

        <Section title="Why you came to hospital">{a.reason}</Section>
        <Section title="What we found (diagnosis)">{a.finalDiagnosis}</Section>
        {a.treatmentGiven && <Section title="What we did">{a.treatmentGiven}</Section>}
        <Section title="Your condition when you went home">{CONDITION_LABELS[a.conditionAtDischarge]}</Section>

        {meds.length > 0 && (
          <section className="border-t py-4">
            <h2 className="mb-2 font-bold">Your medicines</h2>
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr><th className="py-1 pr-3 font-medium">Medicine</th><th className="py-1 pr-3 font-medium">How much</th><th className="py-1 pr-3 font-medium">When</th><th className="py-1 font-medium">For how long</th></tr>
              </thead>
              <tbody className="divide-y">
                {meds.map((m, i) => (
                  <tr key={i}><td className="py-1.5 pr-3 font-semibold">{m.name}</td><td className="py-1.5 pr-3">{m.dose || "—"}</td><td className="py-1.5 pr-3">{m.frequency || "—"}</td><td className="py-1.5">{m.duration || "—"}</td></tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {a.dischargeAdvice && <Section title="How to look after yourself at home">{a.dischargeAdvice}</Section>}
        {a.followUpDate && <Section title="Your next visit">{fmtDate(a.followUpDate)} with Dr. {fullName(a.doctor.user)} ({a.department.name}). Please bring this summary.</Section>}
        {a.warningSigns && (
          <section className="mt-2 rounded-lg border border-rose-300 bg-rose-50 p-4 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
            <h2 className="font-bold">Come to the hospital immediately if you have:</h2>
            <p className="mt-1 whitespace-pre-wrap">{a.warningSigns}</p>
          </section>
        )}
        <footer className="mt-6 border-t pt-3 text-xs text-muted-foreground">
          Show your UHID {a.patient.uhid} at any {HOSPITAL_NAME} hospital — your records are available there.
        </footer>
      </article>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="border-t py-4 first:border-t-0">
      <h2 className="mb-1 font-bold">{title}</h2>
      <p className="whitespace-pre-wrap">{children}</p>
    </section>
  );
}
