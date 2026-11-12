import { ensureUser } from "@/lib/auth";
import DashboardShell from "./layout-shell";

export default async function DashboardLayout({ children }) {
  let user = null;
  let role = "PATIENT";

  try {
    user = await ensureUser();
    if (user) role = user.role;
  } catch (e) {
    console.error("Dashboard layout auth error:", e.message);
  }

  return (
    <DashboardShell role={role} user={user}>
      {children}
    </DashboardShell>
  );
}