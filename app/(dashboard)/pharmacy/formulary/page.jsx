import { redirect } from "next/navigation";
import { guardPage } from "@/lib/guards";
import { getFormulary } from "@/actions/pharmacy";
import { FormularyEditor } from "@/components/pharmacy/formulary-editor";

export const metadata = { title: "Formulary & Stock | Smart Hospital" };

export default async function FormularyPage() {
  const guard = await guardPage("formulary", "create");
  if (!guard.authorized) redirect(guard.status === 403 ? "/forbidden" : "/sign-in");
  const res = await getFormulary({});
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Formulary & Stock</h1>
        <p className="text-sm text-muted-foreground">Medicines doctors can prescribe and the stock on hand by batch. Stock is used earliest expiry first; expired batches are never issued.</p>
      </div>
      <FormularyEditor medicines={res.success ? res.data : []} />
    </div>
  );
}
