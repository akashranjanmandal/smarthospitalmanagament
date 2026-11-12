import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { guardPage } from "@/lib/guards";
import { getAdmission } from "@/actions/admissions";
import { getAdmissionBill } from "@/actions/ipd-billing";
import { PrintButton } from "@/components/inpatient/print-button";
import { fmtDate, fmtDateTime, ageSex, fullName, inr, CATEGORY_LABELS } from "@/lib/format";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "In-patient Bill | Smart Hospital" };

const HOSPITAL_NAME = process.env.NEXT_PUBLIC_HOSPITAL_NAME || "Smart Hospital";
const PAYER = { SELF: "Self", INSURANCE: "Insurance / TPA", CORPORATE: "Corporate", GOVERNMENT_SCHEME: "Government scheme" };

export default async function BillPage({ params }) {
  const guard = await guardPage("billing", "read");
  if (!guard.authorized || guard.role === "PATIENT") redirect(guard.status === 401 ? "/sign-in" : "/forbidden");
  const { id } = await params;
  const [adm, res] = await Promise.all([getAdmission(id), getAdmissionBill(id)]);
  if (!adm.success || !res.success) notFound();
  const a = adm.data;
  const b = res.data;
  const t = b.totals;
  const live = b.lines.filter((l) => !l.cancelled);
  const groups = Object.entries(CATEGORY_LABELS)
    .map(([cat, label]) => ({ cat, label, lines: live.filter((l) => l.category === cat) }))
    .filter((g) => g.lines.length);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link href={`/admissions/${id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Back to chart</Link>
        <PrintButton label="Print bill" />
      </div>

      <article className="rounded-xl border bg-card p-6 text-sm sm:p-8 print:border-0 print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">{HOSPITAL_NAME}</p>
            <h1 className="mt-1 text-2xl font-bold">{b.finalized ? "Final In-patient Bill" : "Interim In-patient Bill"}</h1>
          </div>
          <div className="text-right tabular-nums">
            <div className="font-mono font-semibold">{b.finalized?.billNumber ?? "Not final"}</div>
            <div className="text-muted-foreground">{b.finalized ? fmtDateTime(b.finalized.finalizedAt) : `As of ${fmtDateTime(new Date())}`}</div>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-x-6 gap-y-2 border-b py-4 sm:grid-cols-3">
          <div><span className="text-muted-foreground">Patient</span><div className="font-semibold">{fullName(a.patient)} ({ageSex(a.patient)})</div></div>
          <div><span className="text-muted-foreground">UHID</span><div className="font-semibold tabular-nums">{a.patient.uhid}</div></div>
          <div><span className="text-muted-foreground">IP number</span><div className="font-semibold tabular-nums">{a.admissionNumber}</div></div>
          <div><span className="text-muted-foreground">Admitted</span><div className="font-semibold">{fmtDate(a.admittedAt)}</div></div>
          <div><span className="text-muted-foreground">Discharged</span><div className="font-semibold">{a.dischargedAt ? fmtDate(a.dischargedAt) : "In hospital"}</div></div>
          <div><span className="text-muted-foreground">Doctor</span><div className="font-semibold">Dr. {fullName(a.doctor.user)} · {a.department.name}</div></div>
          <div className="col-span-2 sm:col-span-3">
            <span className="text-muted-foreground">Payer</span>
            <div className="font-semibold">{PAYER[b.insurance.payerType]}{b.insurance.insured ? ` — ${[b.insurance.insurerName, b.insurance.tpaName].filter(Boolean).join(" / ")}, policy ${b.insurance.policyNumber}` : ""}</div>
          </div>
        </section>

        <table className="mt-4 w-full">
          <thead className="border-b text-left text-xs text-muted-foreground">
            <tr><th className="py-1.5">Particulars</th><th className="py-1.5 text-right">Qty</th><th className="py-1.5 text-right">Rate</th><th className="py-1.5 text-right">GST</th><th className="py-1.5 text-right">Amount</th></tr>
          </thead>
          <tbody>
            <tr className="border-b border-dashed"><td className="py-1.5 font-semibold" colSpan={5}>Room</td></tr>
            <tr><td className="py-1 pl-3">Room charges ({b.bedType.replace("_", " ").toLowerCase()})</td><td className="py-1 text-right tabular-nums">{t.room.days}</td><td className="py-1 text-right tabular-nums">{inr(t.room.rate)}</td><td className="py-1 text-right">—</td><td className="py-1 text-right tabular-nums">{inr(t.room.total)}</td></tr>
            {groups.map((g) => (
              <FragmentRows key={g.cat} label={g.label} lines={g.lines} />
            ))}
          </tbody>
          <tfoot className="border-t">
            <tr><td colSpan={4} className="pt-2 text-right text-muted-foreground">Subtotal</td><td className="pt-2 text-right tabular-nums">{inr(t.subtotal)}</td></tr>
            <tr><td colSpan={4} className="text-right text-muted-foreground">GST</td><td className="text-right tabular-nums">{inr(t.gst)}</td></tr>
            {t.discount > 0 && <tr><td colSpan={4} className="text-right text-muted-foreground">Discount</td><td className="text-right tabular-nums">− {inr(t.discount)}</td></tr>}
            <tr className="text-base font-bold"><td colSpan={4} className="pt-1 text-right">Total</td><td className="pt-1 text-right tabular-nums">{inr(t.total)}</td></tr>
          </tfoot>
        </table>

        <section className="mt-6 grid gap-4 border-t pt-4 sm:grid-cols-2">
          <div>
            <h2 className="mb-1 font-semibold">Payments received</h2>
            {b.payments.length === 0 ? <p className="text-muted-foreground">None</p> : (
              <ul className="space-y-0.5">
                {b.payments.map((p) => <li key={p.id} className="flex justify-between gap-2 tabular-nums"><span>{p.receiptNumber} · {p.kind.toLowerCase()} · {p.method}</span><span>{p.kind === "REFUND" ? "− " : ""}{inr(p.amount)}</span></li>)}
              </ul>
            )}
          </div>
          <dl className="space-y-1 tabular-nums">
            {b.insurance.insured && <div className="flex justify-between"><dt>Payable by insurer</dt><dd>{inr(t.insurerPays)}</dd></div>}
            <div className="flex justify-between"><dt>Payable by patient</dt><dd>{inr(t.patientShare)}</dd></div>
            <div className="flex justify-between"><dt>Received from patient</dt><dd>{inr(t.received)}</dd></div>
            <div className="flex justify-between border-t pt-1 text-base font-bold"><dt>{t.balanceDue >= 0 ? "Balance due" : "Refund due to patient"}</dt><dd>{inr(Math.abs(t.balanceDue))}</dd></div>
          </dl>
        </section>
        <footer className="mt-6 border-t pt-3 text-xs text-muted-foreground">Computer-generated bill. Healthcare services are exempt from GST; GST is charged only on applicable pharmacy and consumable items.</footer>
      </article>
    </div>
  );
}

function FragmentRows({ label, lines }) {
  return (
    <>
      <tr className="border-b border-dashed"><td className="pt-3 pb-1.5 font-semibold" colSpan={5}>{label}</td></tr>
      {lines.map((l) => (
        <tr key={l.id}>
          <td className="py-1 pl-3">{l.description}</td>
          <td className="py-1 text-right tabular-nums">{l.quantity}</td>
          <td className="py-1 text-right tabular-nums">{inr(l.unitPrice)}</td>
          <td className="py-1 text-right tabular-nums">{l.gstRate ? `${l.gstRate}%` : "—"}</td>
          <td className="py-1 text-right tabular-nums">{inr(l.amount)}</td>
        </tr>
      ))}
    </>
  );
}
