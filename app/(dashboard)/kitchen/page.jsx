import { redirect } from "next/navigation";
import { guardPage } from "@/lib/guards";
import { getKitchenList } from "@/actions/meals";
import { KitchenBoard } from "@/components/meals/kitchen-board";
import { MEALS } from "@/lib/diet/meals";
import { istDateString } from "@/lib/dates";

export const metadata = { title: "Kitchen & Meals | Smart Hospital" };

/** The next meal to be served (IST), so the page opens on what matters now. */
function upcomingMeal() {
  const now = new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false });
  return MEALS.find((m) => m.serve >= now)?.key ?? "BREAKFAST";
}

export default async function KitchenPage({ searchParams }) {
  const guard = await guardPage("meals", "update");
  if (!guard.authorized) redirect(guard.status === 403 ? "/forbidden" : "/sign-in");
  const params = await searchParams;
  const meal = MEALS.some((m) => m.key === params.meal) ? params.meal : upcomingMeal();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? "") ? params.date : istDateString();
  const res = await getKitchenList({ date, meal });
  return <KitchenBoard data={res.success ? res.data : null} role={guard.role} />;
}
