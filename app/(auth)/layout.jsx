import { Activity, ShieldCheck, IdCard, ArrowLeftRight } from "lucide-react";

const HOSPITAL_NAME = process.env.NEXT_PUBLIC_HOSPITAL_NAME || "Smart Hospital";

const POINTS = [
  { icon: IdCard, title: "One patient, one UHID", text: "Records follow the patient to every hospital in the network." },
  { icon: ArrowLeftRight, title: "Shift handover built in", text: "Vitals, notes and pending tasks pass to the next shift in writing." },
  { icon: ShieldCheck, title: "Every action on record", text: "Role-based access and a complete activity log for administrators." },
];

export default function AuthLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-card">
      {/* Brand panel (desktop) */}
      <aside className="relative hidden w-[44%] max-w-[640px] flex-col justify-between overflow-hidden bg-[#06283a] p-12 text-white lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "22px 22px" }}
        />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 -right-40 size-[520px] rounded-full bg-teal-500/20 blur-3xl" />

        <div className="relative flex items-center gap-2.5">
          <div className="flex size-10 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/20">
            <Activity className="size-5" />
          </div>
          <div className="leading-tight">
            <div className="text-base font-bold">{HOSPITAL_NAME}</div>
            <div className="text-xs text-sky-100/70">Hospital Management System</div>
          </div>
        </div>

        <div className="relative space-y-8">
          <h1 className="max-w-md text-[2.1rem] font-bold leading-[1.15] tracking-tight">
            Every ward, desk and patient on one system.
          </h1>
          <ul className="space-y-5">
            {POINTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3.5">
                <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                  <Icon className="size-[18px] text-teal-300" />
                </div>
                <div>
                  <div className="font-semibold">{title}</div>
                  <p className="text-sm leading-relaxed text-sky-100/75">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-sky-100/60">For authorised hospital staff and registered patients. Activity is logged.</p>
      </aside>

      {/* Form */}
      <main className="flex flex-1 flex-col">
        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-[420px]">{children}</div>
        </div>
        <footer className="px-5 pb-6 text-center text-xs text-muted-foreground sm:px-8">
          © {new Date().getFullYear()} {HOSPITAL_NAME} · Need help signing in? Contact your hospital IT desk.
        </footer>
      </main>
    </div>
  );
}
