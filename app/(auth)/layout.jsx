import { Brand } from "@/components/auth/brand";

const HOSPITAL_NAME = process.env.NEXT_PUBLIC_HOSPITAL_NAME || "Smart Hospital";

export default function AuthLayout({ children }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-5 py-10 sm:px-8" style={{ paddingTop: "max(40px, calc(env(safe-area-inset-top, 0px) + 24px))" }}>
      <div className="flex w-full max-w-[420px] flex-col items-center gap-6">
        <Brand />
        <div className="w-full rounded-2xl border border-border/70 bg-card p-6 shadow-soft sm:p-8">{children}</div>
        <p className="px-2 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} {HOSPITAL_NAME} · Need help signing in? Contact your hospital IT desk.
        </p>
      </div>
    </div>
  );
}
