import { PageLoader } from "@/components/shared/page-loader";

export default function BedsLoading() {
  return <PageLoader messages={["Loading bed inventory…", "Checking ward availability…", "Preparing room status…"]} />;
}
