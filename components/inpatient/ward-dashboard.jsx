import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Panel, Chip, VitalFlags } from "@/components/inpatient/ui";
import { vitalFlags } from "@/lib/clinical/vitals";
import { fmtDateTime, fullName } from "@/lib/format";
import { lengthOfStayDays } from "@/lib/identifiers";
import { CriticalAlerts } from "@/components/lab/critical-alerts";

/** Start-of-shift view for nurses and ward attendants. */
export async function WardDashboard({ user, role }) {
  const [admissions, bedCounts, cleaning] = await Promise.all([
    prisma.admission.findMany({
      where: { status: "ADMITTED" },
      include: {
        patient: { select: { firstName: true, lastName: true, uhid: true } },
        bed: { select: { bedNumber: true, ward: { select: { name: true } } } },
        vitals: { orderBy: { recordedAt: "desc" }, take: 1 },
        handovers: { orderBy: { createdAt: "desc" }, take: 1, select: { acknowledgedById: true } },
      },
      orderBy: [{ bed: { ward: { name: "asc" } } }, { bed: { bedNumber: "asc" } }],
    }),
    prisma.bed.groupBy({ by: ["status"], _count: true }),
    prisma.bed.findMany({
      where: { status: "NEEDS_CLEANING" },
      select: { id: true, bedNumber: true, statusUpdatedAt: true, ward: { select: { name: true } } },
      orderBy: { statusUpdatedAt: "asc" },
    }),
  ]);

  const count = Object.fromEntries(bedCounts.map((b) => [b.status, b._count]));
  const staleBefore = vitalsDueCutoff();
  const withFlags = admissions.map((a) => ({ ...a, latest: a.vitals[0], flags: a.vitals[0] ? vitalFlags(a.vitals[0]) : [] }));
  const needsAttention = withFlags.filter((a) => a.flags.length || !a.latest || new Date(a.latest.recordedAt) < staleBefore);
  const unacknowledged = withFlags.filter((a) => a.handovers[0] && !a.handovers[0].acknowledgedById).length;
  const isNurse = role === "NURSE";

  const tiles = [
    ["In-patients", admissions.length, "/admissions"],
    ["Vacant beds", count.VACANT ?? 0, "/beds"],
    ["Beds to clean", count.NEEDS_CLEANING ?? 0, "/beds"],
    isNurse ? ["Handovers to acknowledge", unacknowledged, "/handover"] : ["Reserved beds", count.RESERVED ?? 0, "/beds"],
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Good {greeting()}, {user.firstName}</h1>
        <p className="text-sm text-muted-foreground">{isNurse ? "Your ward at the start of this shift." : "Beds and tasks on the ward right now."}</p>
      </div>

      {isNurse && <CriticalAlerts />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(([label, value, href]) => (
          <Link key={label} href={href} className="rounded-xl border border-border/70 bg-card p-4 hover:border-primary/40">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
            <div className="mt-1 text-3xl font-bold tabular-nums">{value}</div>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {isNurse && (
          <Panel title={`Needs attention (${needsAttention.length})`} action={<Link href="/handover" className="text-xs font-semibold text-primary hover:underline">Handover sheet →</Link>} bodyClassName="p-0">
            {needsAttention.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">All patients have recent, normal vitals.</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {needsAttention.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <div className="min-w-0">
                      <Link href={`/admissions/${a.id}`} className="font-semibold text-primary hover:underline">{a.bed.bedNumber} · {fullName(a.patient)}</Link>
                      <div className="text-xs text-muted-foreground">Day {lengthOfStayDays(a.admittedAt)} · {a.latest ? `vitals ${fmtDateTime(a.latest.recordedAt)}` : "no vitals yet"}</div>
                    </div>
                    {a.flags.length ? <VitalFlags flags={a.flags} /> : <Chip tone="warn">{a.latest ? "Vitals due" : "Chart vitals"}</Chip>}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}

        <Panel title={`Beds waiting for cleaning (${cleaning.length})`} action={<Link href="/beds" className="text-xs font-semibold text-primary hover:underline">Bed board →</Link>} bodyClassName="p-0">
          {cleaning.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No beds are waiting for housekeeping.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {cleaning.map((b) => (
                <li key={b.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="font-semibold">{b.bedNumber} <span className="font-normal text-muted-foreground">· {b.ward.name}</span></span>
                  <span className="text-xs text-muted-foreground">since {fmtDateTime(b.statusUpdatedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

// Vitals older than six hours are due again.
function vitalsDueCutoff() {
  return new Date(Date.now() - 6 * 60 * 60 * 1000);
}

function greeting() {
  const h = Number(new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", hour12: false }));
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}
