import { prisma } from "@/lib/prisma";
import { FeedbackKiosk } from "@/components/feedback/feedback-kiosk";

export const dynamic = "force-dynamic";

export default async function FeedbackPage() {
  const departments = await prisma.department.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return <FeedbackKiosk departments={departments} />;
}
