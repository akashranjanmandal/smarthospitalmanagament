import Link from "next/link";
import { getCriticalAlerts } from "@/actions/lab";
import { fmtTime } from "@/lib/format";
import { AlertTriangle } from "lucide-react";

/** Unacknowledged critical lab results for the signed-in doctor or nurse. Renders nothing when there are none. */
export async function CriticalAlerts() {
  const res = await getCriticalAlerts();
  const alerts = res.success ? res.data : [];
  if (!alerts.length) return null;
  return (
    <section role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
      <h2 className="flex items-center gap-2 text-sm font-bold"><AlertTriangle className="size-4" /> Critical lab results to act on ({alerts.length})</h2>
      <ul className="mt-2 space-y-1.5 text-sm">
        {alerts.map((a) => (
          <li key={a.orderId} className="flex flex-wrap items-baseline justify-between gap-2">
            <span>
              <span className="font-semibold">{a.patientName}</span>{a.bed ? ` · bed ${a.bed}` : ""} — {a.testName}: {a.values.map((v) => `${v.name} ${v.value} ${v.unit}`).join(", ")}
            </span>
            <span className="flex items-center gap-3 text-xs">
              <span className="opacity-80">released {fmtTime(a.verifiedAt)}</span>
              {a.admissionId && <Link href={`/admissions/${a.admissionId}`} className="font-semibold underline">Open chart</Link>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
