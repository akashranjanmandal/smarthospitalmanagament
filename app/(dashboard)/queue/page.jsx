import { redirect } from "next/navigation";
import { guardPage } from "@/lib/guards";
import { canUpdate } from "@/lib/permissions";
import { getQueue } from "@/actions/queue";
import { QueueBoard } from "@/components/queue/queue-board";

export const metadata = { title: "OPD Queue | Smart Hospital" };

export default async function QueuePage({ searchParams }) {
  const guard = await guardPage("queue", "read");
  if (!guard.authorized) redirect(guard.status === 403 ? "/forbidden" : "/sign-in");
  const params = await searchParams;
  const result = await getQueue({ doctorId: params.doctor });
  const data = result.success ? result.data : { date: "", doctors: [] };

  return (
    <QueueBoard
      data={data}
      role={guard.role}
      canAct={canUpdate("queue", guard.role)}
      canComplete={canUpdate("appointments", guard.role) && guard.role !== "PATIENT"}
    />
  );
}
