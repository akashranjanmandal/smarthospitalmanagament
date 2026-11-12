import { PageLoader } from "@/components/shared/page-loader";

export default function Loading() {
  return <PageLoader messages={["Loading records…", "Reviewing files…", "Preparing patient history…"]} />;
}