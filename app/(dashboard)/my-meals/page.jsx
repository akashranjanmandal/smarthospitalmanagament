import { redirect } from "next/navigation";
import { guardPage } from "@/lib/guards";
import { getMyMeals } from "@/actions/meals";
import { MealDays } from "@/components/meals/meal-days";

export const metadata = { title: "My Meals | Smart Hospital" };

export default async function MyMealsPage() {
  const guard = await guardPage("meals", "create");
  if (!guard.authorized) redirect(guard.status === 403 ? "/forbidden" : "/sign-in");
  if (guard.role !== "PATIENT") redirect("/kitchen");
  const res = await getMyMeals();
  const data = res.success ? res.data : null;
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Meals</h1>
        <p className="text-sm text-muted-foreground">Choose your breakfast, lunch, snacks and dinner from the dishes your doctor’s diet allows. If you don’t choose, the kitchen sends the standard meal for your diet.</p>
      </div>
      {data ? <MealDays data={data} /> : <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Meals can be ordered while you are admitted.</div>}
    </div>
  );
}
