import { PageLoader } from "@/components/shared/page-loader";

export default function FeedbackLoading() {
  return <PageLoader messages={["Loading feedback desk…", "Reviewing reports…", "Preparing tickets…"]} />;
}
