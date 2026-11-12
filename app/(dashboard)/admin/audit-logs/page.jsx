import { redirect } from "next/navigation";
import { guardPage } from "@/lib/guards";
import { getAuditLogs } from "@/actions/audit";
import { AuditLogView } from "@/components/admin/audit-log-view";

export const metadata = { title: "Activity Log | Smart Hospital" };

export default async function AuditLogsPage({ searchParams }) {
  const guard = await guardPage("audit", "read");
  if (!guard.authorized) redirect(guard.status === 403 ? "/forbidden" : "/sign-in");
  const params = await searchParams;
  const result = await getAuditLogs({
    entity: params.entity,
    action: params.action,
    actorId: params.actor,
    search: params.q,
    from: params.from,
    to: params.to,
    page: params.page,
  });
  const data = result.success ? result.data : { logs: [], total: 0, page: 1, totalPages: 1, entities: [] };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Activity Log</h1>
        <p className="text-sm text-muted-foreground">Every change made in the system and every sign-in — who did it, when, and exactly what changed.</p>
      </div>
      <AuditLogView data={data} />
    </div>
  );
}
