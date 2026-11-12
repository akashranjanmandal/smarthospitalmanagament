import Link from "next/link";
import { redirect } from "next/navigation";
import { guardPage } from "@/lib/guards";
import { getWardHandoverSheet } from "@/actions/nursing";
import { Chip, VitalFlags, VitalsLine } from "@/components/inpatient/ui";
import { HandoverToolbar } from "@/components/inpatient/handover-toolbar";
import { fmtDateTime, ageSex, fullName } from "@/lib/format";

export const metadata = { title: "Ward Handover | Smart Hospital" };

export default async function HandoverPage({ searchParams }) {
  const guard = await guardPage("nursing", "read");
  if (!guard.authorized) redirect(guard.status === 403 ? "/forbidden" : "/sign-in");
  const params = await searchParams;
  const result = await getWardHandoverSheet({ wardId: params.ward });
  const { patients, wards, generatedAt } = result.success ? result.data : { patients: [], wards: [], generatedAt: new Date() };
  const pending = patients.filter((p) => p.latestHandover && !p.latestHandover.acknowledged).length;
  const alerts = patients.filter((p) => p.latestVitals?.flags.length).length;
  const ward = wards.find((w) => w.id === params.ward);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Shift Handover{ward ? ` — ${ward.name}` : ""}</h1>
          <p className="text-sm text-muted-foreground">
            {patients.length} in-patient{patients.length === 1 ? "" : "s"} · {alerts} with abnormal vitals · {pending} handover{pending === 1 ? "" : "s"} awaiting acknowledgement · as of {fmtDateTime(generatedAt)}
          </p>
        </div>
        <HandoverToolbar wards={wards} />
      </div>

      {patients.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">No patients are admitted{ward ? " in this ward" : ""}.</div>
      ) : (
        <div className="space-y-3">
          {patients.map((p) => (
            <article key={p.admissionId} className="break-inside-avoid rounded-xl border border-border/70 bg-card">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-2.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="rounded-md bg-foreground px-2 py-0.5 text-sm font-bold text-background">{p.bedNumber}</span>
                  <Link href={`/admissions/${p.admissionId}`} className="font-semibold text-primary hover:underline">{fullName(p.patient)}</Link>
                  <span className="text-xs text-muted-foreground tabular-nums">{p.patient.uhid} · {ageSex(p.patient)} · Day {p.dayOfStay} · {p.ward.name}</span>
                </div>
                <div className="text-xs text-muted-foreground">{p.doctor} · {p.department}</div>
              </header>
              <div className="grid gap-x-6 gap-y-3 p-4 text-sm lg:grid-cols-3">
                <div className="space-y-1">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Admitted for</h3>
                  <p>{p.reason}{p.provisionalDiagnosis ? ` — ${p.provisionalDiagnosis}` : ""}</p>
                  <h3 className="pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Latest vitals</h3>
                  {p.latestVitals ? (
                    <div className="space-y-1">
                      <VitalsLine v={p.latestVitals} />
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <VitalFlags flags={p.latestVitals.flags} />
                        <span>{fmtDateTime(p.latestVitals.recordedAt)} · {p.latestVitals.recordedBy}</span>
                      </div>
                    </div>
                  ) : (
                    <Chip tone="warn">No vitals charted</Chip>
                  )}
                </div>
                <div className="space-y-1">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Latest note</h3>
                  {p.latestNote ? (
                    <>
                      <p className="line-clamp-4 whitespace-pre-wrap">{p.latestNote.content}</p>
                      <p className="text-xs text-muted-foreground">{p.latestNote.author} · {fmtDateTime(p.latestNote.createdAt)}</p>
                    </>
                  ) : (
                    <p className="text-muted-foreground">No notes yet</p>
                  )}
                </div>
                <div className="space-y-1">
                  <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Last handover
                    {p.latestHandover && (p.latestHandover.acknowledged ? <Chip tone="good">Received</Chip> : <Chip tone="warn">Not acknowledged</Chip>)}
                  </h3>
                  {p.latestHandover ? (
                    <>
                      <p><span className="font-semibold">R:</span> {p.latestHandover.recommendation}</p>
                      {p.latestHandover.pendingTasks && <p><span className="font-semibold">Pending:</span> {p.latestHandover.pendingTasks}</p>}
                      <p className="text-xs text-muted-foreground">{p.latestHandover.from} · {fmtDateTime(p.latestHandover.createdAt)}</p>
                    </>
                  ) : (
                    <p className="text-muted-foreground">No handover recorded</p>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
