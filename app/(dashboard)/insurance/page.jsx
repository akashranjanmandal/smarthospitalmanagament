import Link from "next/link";
import { redirect } from "next/navigation";
import { guardPage } from "@/lib/guards";
import { getInsuranceWorklist } from "@/actions/insurance";
import { Panel, Chip } from "@/components/inpatient/ui";
import { inr } from "@/lib/format";

export const metadata = { title: "Insurance Desk | Smart Hospital" };

const KIND = { INITIAL: "Pre-auth", ENHANCEMENT: "Enhancement", FINAL: "Final approval" };

function Row({ r, right }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
      <div className="min-w-0">
        <Link href={`/admissions/${r.admissionId}`} className="font-semibold text-primary hover:underline">{r.patientName}</Link>
        <div className="truncate text-xs text-muted-foreground tabular-nums">{r.uhid} · {r.admissionNumber} · {r.insurer}</div>
      </div>
      <div className="flex items-center gap-2">{right}</div>
    </li>
  );
}

function Section({ title, items, empty, render }) {
  return (
    <Panel title={`${title} (${items.length})`} bodyClassName="p-0">
      {items.length === 0 ? <p className="p-4 text-sm text-muted-foreground">{empty}</p> : <ul className="divide-y divide-border/60">{items.map(render)}</ul>}
    </Panel>
  );
}

export default async function InsuranceDeskPage() {
  const guard = await guardPage("insurance", "create");
  if (!guard.authorized) redirect(guard.status === 403 ? "/forbidden" : "/sign-in");
  const res = await getInsuranceWorklist();
  const w = res.success ? res.data : { awaitingInsurer: [], needsPreAuth: [], nearLimit: [], awaitingFinal: [], readyToClaim: [], openClaims: [], stats: { claimed: 0, settled: 0, deducted: 0 } };

  const tiles = [
    ["Awaiting insurer", w.awaitingInsurer.length],
    ["Near / over limit", w.nearLimit.length],
    ["Discharges on hold", w.awaitingFinal.length],
    ["Open claims", w.openClaims.length],
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Insurance / TPA Desk</h1>
        <p className="text-sm text-muted-foreground">
          Claimed {inr(w.stats.claimed)} · settled {inr(w.stats.settled)} · deducted {inr(w.stats.deducted)}
          {w.stats.claimed > 0 && ` (${Math.round((w.stats.deducted / Math.max(w.stats.settled + w.stats.deducted, 1)) * 100)}% of settled claims)`}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(([l, n]) => (
          <div key={l} className="rounded-xl border border-border/70 bg-card p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{l}</div>
            <div className="mt-1 text-3xl font-bold tabular-nums">{n}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Waiting on the insurer" items={w.awaitingInsurer} empty="No requests are waiting on insurers." render={(r) => (
          <Row key={r.preAuth.id} r={r} right={<>
            <Chip tone={r.preAuth.status === "QUERY" ? "warn" : "info"}>{KIND[r.preAuth.kind]} · {r.preAuth.status === "QUERY" ? "query" : "sent"}</Chip>
            <span className="tabular-nums">{inr(r.preAuth.requestedAmount)}</span>
            <Chip tone={r.hoursWaiting >= 4 ? "bad" : "neutral"}>{r.hoursWaiting} h</Chip>
          </>} />
        )} />
        <Section title="Need a pre-authorisation" items={w.needsPreAuth} empty="Every insured in-patient has a pre-authorisation." render={(r) => (
          <Row key={r.admissionId} r={r} right={<span className="tabular-nums text-muted-foreground">bill {inr(r.bill)}</span>} />
        )} />
        <Section title="Near or over the approved amount" items={w.nearLimit} empty="No stays are near their approved amount." render={(r) => (
          <Row key={r.admissionId} r={r} right={<>
            <span className="tabular-nums">{inr(r.bill)} / {inr(r.approvedAmount)}</span>
            <Chip tone={r.usage.level === "over" ? "bad" : "warn"}>{r.usage.percent}%</Chip>
          </>} />
        )} />
        <Section title="Final bill ready — request final approval" items={w.awaitingFinal} empty="No discharges are waiting on final approval." render={(r) => (
          <Row key={r.admissionId} r={r} right={<span className="tabular-nums">{inr(r.bill)}</span>} />
        )} />
        <Section title="Ready to file claim" items={w.readyToClaim} empty="No discharged stays are waiting for a claim." render={(r) => (
          <Row key={r.admissionId} r={r} right={<span className="tabular-nums">{inr(r.approvedAmount)}</span>} />
        )} />
        <Section title="Open claims" items={w.openClaims} empty="No claims are outstanding." render={(r) => (
          <Row key={r.admissionId} r={r} right={<>
            <span className="font-mono text-xs">{r.claim.claimNumber}</span>
            <span className="tabular-nums">{inr(r.claim.claimedAmount)}</span>
            <Chip tone={r.daysOpen >= 30 ? "bad" : r.daysOpen >= 15 ? "warn" : "neutral"}>{r.daysOpen} days</Chip>
          </>} />
        )} />
      </div>
    </div>
  );
}
