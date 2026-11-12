import { redirect } from "next/navigation";
import { guardPage } from "@/lib/guards";
import { getTariffs } from "@/actions/ipd-billing";
import { TariffEditor } from "@/components/admin/tariff-editor";

export const metadata = { title: "Tariffs | Smart Hospital" };

export default async function TariffsPage() {
  const guard = await guardPage("tariffs", "update");
  if (!guard.authorized) redirect(guard.status === 403 ? "/forbidden" : "/sign-in");
  const res = await getTariffs({});
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tariffs</h1>
        <p className="text-sm text-muted-foreground">The hospital price list used on in-patient bills. Room rates use codes <span className="font-mono">BED-&lt;BED TYPE&gt;</span> and are charged per day automatically. Changes apply to new charges only.</p>
      </div>
      <TariffEditor tariffs={res.success ? res.data : []} />
    </div>
  );
}
