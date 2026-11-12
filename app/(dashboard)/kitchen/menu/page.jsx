import { redirect } from "next/navigation";
import { guardPage } from "@/lib/guards";
import { getMenu } from "@/actions/meals";
import { MenuEditor } from "@/components/meals/menu-editor";

export const metadata = { title: "Menu | Smart Hospital" };

export default async function MenuPage() {
  const guard = await guardPage("menu", "create");
  if (!guard.authorized) redirect(guard.status === 403 ? "/forbidden" : "/sign-in");
  const res = await getMenu();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Menu</h1>
        <p className="text-sm text-muted-foreground">Dishes for each meal and the diets each one suits. Patients only see dishes allowed for their diet. Regular dishes are included in the room rate; extras are charged to the bill.</p>
      </div>
      <MenuEditor items={res.success ? res.data : []} />
    </div>
  );
}
