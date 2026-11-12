import { redirect } from "next/navigation";
import { guardPage } from "@/lib/guards";
import { getQueueDisplay } from "@/actions/queue";
import { QueueDisplay } from "@/components/queue/queue-display";

export const metadata = { title: "Now Serving | Smart Hospital" };

// Full-screen waiting-room board (open on the lobby TV from a signed-in front-desk account).
export default async function QueueDisplayPage() {
  const guard = await guardPage("queue", "read");
  if (!guard.authorized) redirect(guard.status === 403 ? "/forbidden" : "/sign-in?redirect=/queue-display");
  const result = await getQueueDisplay();
  return <QueueDisplay boards={result.success ? result.data : []} hospital={process.env.NEXT_PUBLIC_HOSPITAL_NAME || "Smart Hospital"} />;
}
