import { PageLoader } from "@/components/shared/page-loader";

export default function DashboardLoading() {
  return <PageLoader messages={["Loading dashboard…", "Checking appointments…", "Syncing patient data…"]} />;
}