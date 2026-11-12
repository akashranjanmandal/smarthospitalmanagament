import { PageLoader } from "@/components/shared/page-loader";

export default function Loading() {
  return <PageLoader messages={["Loading prescriptions…", "Checking medication records…", "Preparing care plans…"]} />;
}