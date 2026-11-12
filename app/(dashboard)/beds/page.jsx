import { guardPage } from "@/lib/guards";
import { getBedDashboardData } from "@/actions/beds";
import { BedDashboard } from "@/components/beds/bed-dashboard";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Bed Occupancy Tracker | Smart Hospital",
  description: "Real-time bed occupancy dashboard across all hospital wards and floors",
};

export default async function BedsPage() {
  const guard = await guardPage("beds", "read");

  if (!guard.authorized) {
    if (guard.status === 401) {
      redirect("/sign-in");
    }
    if (guard.status === 403) {
      redirect("/forbidden");
    }
    redirect("/sign-in");
  }

  const bedDataResult = await getBedDashboardData();
  const initialData = bedDataResult.success
    ? bedDataResult.data
    : { floors: {}, stats: { total: 0, vacant: 0, occupied: 0, reserved: 0, needsCleaning: 0 }, wards: [] };

  return (
    <div className="space-y-6">
      {/* Main Dashboard Client View */}
      <BedDashboard initialData={initialData} userRole={guard.role} />
    </div>
  );
}
