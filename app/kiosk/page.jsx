import { redirect } from "next/navigation";
import { guardPage } from "@/lib/guards";
import { kioskOptions } from "@/actions/kiosk";
import { KioskApp } from "@/components/kiosk/kiosk-app";

export const metadata = { title: "Self-service Kiosk | Smart Hospital" };

export default async function KioskPage() {
  const guard = await guardPage("kiosk", "read");
  if (!guard.authorized) redirect(guard.status === 403 ? "/forbidden" : "/sign-in?redirect=/kiosk");
  const options = await kioskOptions();
  return <KioskApp departments={options.success ? options.data.departments : []} hospital={process.env.NEXT_PUBLIC_HOSPITAL_NAME || "Smart Hospital"} />;
}
