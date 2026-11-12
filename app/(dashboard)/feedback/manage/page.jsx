import { guardPage } from "@/lib/guards";
import { getFeedbackDashboardData } from "@/actions/feedback";
import { StaffFeedbackDashboard } from "@/components/feedback/staff-dashboard";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Grievance Redressal & Escalation Center | Smart Hospital",
  description: "Manage patient complaints, track SLA time guarantees, and record corrective actions.",
};

export default async function ManageFeedbackPage() {
  const guard = await guardPage("feedback", "update");

  if (!guard.authorized) {
    if (guard.status === 401) {
      redirect("/sign-in");
    }
    if (guard.status === 403) {
      redirect("/forbidden");
    }
    redirect("/sign-in");
  }

  const result = await getFeedbackDashboardData();
  const initialData = result.success
    ? result.data
    : { complaints: [], departments: [], stats: { total: 0, active: 0, resolved: 0, overdue: 0, level2: 0, level3: 0 } };

  return <StaffFeedbackDashboard initialData={initialData} userRole={guard.role} />;
}
