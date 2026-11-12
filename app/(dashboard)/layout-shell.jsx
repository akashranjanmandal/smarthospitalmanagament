"use client";

import { RoleProvider } from "@/hooks/use-role";
import { Wayfinder } from "@/components/shell/wayfinder";

/**
 * The app frame: no sidebar, no top bar. Pages get the whole screen; a floating dock at the
 * bottom (the Wayfinder) holds the few everyday places and opens "Where to?" for everything else.
 */
export default function DashboardLayout({ children, role, user }) {
  return (
    <RoleProvider role={role} user={user}>
      <main className="min-h-screen bg-background pb-32 print:bg-white print:pb-0">
        <div className="mx-auto w-full max-w-[1280px] px-4 pt-6 sm:px-8 sm:pt-10 print:max-w-none print:p-0" style={{ paddingTop: "max(24px, calc(env(safe-area-inset-top, 0px) + 16px))" }}>
          {children}
        </div>
      </main>
      <Wayfinder role={role} user={user} />
    </RoleProvider>
  );
}
