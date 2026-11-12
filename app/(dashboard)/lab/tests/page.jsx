import { redirect } from "next/navigation";
import { guardPage } from "@/lib/guards";
import { getLabCatalog } from "@/actions/lab";
import { TestCatalog } from "@/components/lab/test-catalog";

export const metadata = { title: "Test Catalogue | Smart Hospital" };

export default async function TestCatalogPage() {
  const guard = await guardPage("labCatalog", "create");
  if (!guard.authorized) redirect(guard.status === 403 ? "/forbidden" : "/sign-in");
  const res = await getLabCatalog({ includeInactive: true });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Test Catalogue</h1>
        <p className="text-sm text-muted-foreground">Tests doctors can order, with the normal and critical ranges used to flag results. Ranges should be set by the pathologist.</p>
      </div>
      <TestCatalog tests={res.success ? res.data : []} />
    </div>
  );
}
