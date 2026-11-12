import { PageLoader } from "@/components/shared/page-loader";

export default function Loading() {
  return <PageLoader messages={["Loading billing…", "Pulling invoice data…", "Preparing statements…"]} />;
}