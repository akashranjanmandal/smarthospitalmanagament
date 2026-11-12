import { PageLoader } from "@/components/shared/page-loader";

export default function Loading() {
  return <PageLoader messages={["Loading doctors…", "Checking roster…", "Preparing profiles…"]} />;
}