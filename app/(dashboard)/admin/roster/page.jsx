import { redirect } from "next/navigation";
import { guardPage } from "@/lib/guards";
import { RosterBoard } from "@/components/admin/roster-board";

export const metadata = { title: "Duty Roster | Smart Hospital" };

export default async function RosterPage() {
  const guard = await guardPage("roster", "update");
  if (!guard.authorized) redirect(guard.status === 403 ? "/forbidden" : "/sign-in");
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Duty Roster</h1>
        <p className="text-sm text-muted-foreground">Assign nurses and ward attendants to a ward for the day or night shift. Staff with no roster entry still see every ward in the branch, so nothing changes until you start assigning.</p>
      </div>
      <RosterBoard />
    </div>
  );
}
