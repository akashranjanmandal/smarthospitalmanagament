import { redirect } from "next/navigation";
import { guardPage } from "@/lib/guards";
import { canCreate } from "@/lib/permissions";
import { getOTSchedule, getSchedulableOptions } from "@/actions/ot";
import { OTBoard } from "@/components/ot/ot-board";

export const metadata = { title: "Operation Theatre | Smart Hospital" };

export default async function OTPage({ searchParams }) {
  const guard = await guardPage("ot", "read");
  if (!guard.authorized) redirect(guard.status === 403 ? "/forbidden" : "/sign-in");
  const params = await searchParams;
  const canSchedule = canCreate("ot", guard.role);

  const [schedule, options] = await Promise.all([
    getOTSchedule({}),
    canSchedule ? getSchedulableOptions() : null,
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Operation Theatre</h1>
        <p className="text-sm text-muted-foreground">Today's bookings and the WHO Surgical Safety Checklist for each: sign-in before anaesthesia, time-out before incision, sign-out before the patient leaves theatre.</p>
      </div>
      <OTBoard
        bookings={schedule.success ? schedule.data : []}
        admissions={options?.success ? options.data.admissions : []}
        doctors={options?.success ? options.data.doctors : []}
        canSchedule={canSchedule}
        initialAdmissionId={params.admissionId ?? ""}
      />
    </div>
  );
}
