import { PageLoader } from "@/components/shared/page-loader";

export default function Loading() {
  return <PageLoader messages={["Loading appointments…", "Fetching schedule…", "Checking availability…"]} />;
}