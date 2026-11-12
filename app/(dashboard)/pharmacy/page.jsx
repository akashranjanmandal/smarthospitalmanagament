import { redirect } from "next/navigation";
import { guardPage } from "@/lib/guards";
import { getPharmacyQueue, getFormulary } from "@/actions/pharmacy";
import { PharmacyBoard } from "@/components/pharmacy/pharmacy-board";

export const metadata = { title: "Pharmacy | Smart Hospital" };

export default async function PharmacyPage() {
  const guard = await guardPage("pharmacy", "read");
  if (!guard.authorized) redirect(guard.status === 403 ? "/forbidden" : "/sign-in");
  const [queue, formulary] = await Promise.all([getPharmacyQueue({}), getFormulary({ activeOnly: true })]);
  return <PharmacyBoard orders={queue.success ? queue.data : []} formulary={formulary.success ? formulary.data : []} />;
}
