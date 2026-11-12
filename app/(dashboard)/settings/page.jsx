import { ensureUser } from "@/lib/auth";
import { SettingsView } from "@/components/settings/settings-view";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  let user = null;

  try {
    user = await ensureUser();
  } catch (e) {
    console.error("Settings page auth error:", e.message);
  }

  return <SettingsView user={user} />;
}
