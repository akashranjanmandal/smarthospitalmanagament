"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { kioskSendOtp, kioskVerify, kioskRegister, kioskCheckIn, kioskWalkIn } from "@/actions/kiosk";
import { cn } from "@/lib/utils";
import { Activity, ArrowLeft, CalendarCheck, Delete, Loader2, LogOut, Printer, Stethoscope, UserPlus } from "lucide-react";

const IDLE_MS = 60000;
const DONE_MS = 25000;

function Title({ en, hi, sub }) {
  return (
    <div className="space-y-1 text-center">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{en}</h1>
      {hi && <p className="text-xl text-muted-foreground" lang="hi">{hi}</p>}
      {sub && <p className="pt-1 text-base text-muted-foreground">{sub}</p>}
    </div>
  );
}

function BigButton({ icon: Icon, children, hint, onClick, tone = "primary", disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-5 rounded-2xl border-2 p-6 text-left transition-transform active:scale-[0.99] disabled:opacity-50",
        tone === "primary" ? "border-primary bg-primary text-white" : "border-border bg-card hover:border-primary/50"
      )}
    >
      {Icon && <Icon className="size-9 shrink-0" />}
      <span>
        <span className="block text-2xl font-semibold">{children}</span>
        {hint && <span className={cn("block text-base", tone === "primary" ? "text-white/80" : "text-muted-foreground")}>{hint}</span>}
      </span>
    </button>
  );
}

function NumberPad({ value, onChange, max, masked }) {
  const press = (k) => {
    if (k === "del") return onChange(value.slice(0, -1));
    if (k === "clear") return onChange("");
    if (value.length < max) onChange(value + k);
  };
  const shown = masked ? value.replace(/./g, "•") : value;
  return (
    <div className="mx-auto w-full max-w-sm space-y-4">
      <div className="flex h-16 items-center justify-center rounded-xl border-2 bg-card text-3xl font-semibold tracking-[0.3em] tabular-nums" aria-live="polite">
        {shown || <span className="text-xl tracking-normal text-muted-foreground">{"·".repeat(max)}</span>}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "del"].map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => press(k)}
            aria-label={k === "del" ? "Delete" : k === "clear" ? "Clear" : k}
            className="flex h-16 items-center justify-center rounded-xl border bg-card text-2xl font-semibold active:bg-muted"
          >
            {k === "del" ? <Delete className="size-7" /> : k === "clear" ? <span className="text-base">Clear</span> : k}
          </button>
        ))}
      </div>
    </div>
  );
}

function Primary({ children, onClick, disabled, busy }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled || busy} className="mx-auto flex h-16 w-full max-w-sm items-center justify-center gap-2 rounded-xl bg-primary text-xl font-semibold text-white disabled:opacity-50">
      {busy && <Loader2 className="size-6 animate-spin" />} {children}
    </button>
  );
}

const EMPTY = { step: "home", phone: "", otp: "", ticket: null, patient: null, appointments: [], token: null, departmentId: null, devCode: "" };

export function KioskApp({ departments, hospital }) {
  const [s, setS] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ firstName: "", lastName: "", gender: "", day: "", month: "", year: "" });
  const idle = useRef(null);

  const reset = useCallback(() => {
    setS(EMPTY);
    setError("");
    setForm({ firstName: "", lastName: "", gender: "", day: "", month: "", year: "" });
  }, []);
  const go = (patch) => { setError(""); setS((cur) => ({ ...cur, ...patch })); };

  // Staff can leave kiosk mode to use the main system; the device must be signed in as the kiosk again afterwards.
  const staffSignIn = async () => {
    if (!confirm("Sign this kiosk out? You will go to the sign-in screen, where staff can sign in to the main system. Sign the kiosk account back in afterwards to restart the kiosk.")) return;
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/sign-in";
  };

  // Start over after a minute of no touches (or sooner once the token is shown), so the next person never sees someone else's details.
  useEffect(() => {
    const arm = () => {
      clearTimeout(idle.current);
      if (s.step !== "home") idle.current = setTimeout(reset, s.step === "done" ? DONE_MS : IDLE_MS);
    };
    arm();
    window.addEventListener("pointerdown", arm);
    return () => { clearTimeout(idle.current); window.removeEventListener("pointerdown", arm); };
  }, [s.step, reset]);

  const call = async (fn, onOk) => {
    setBusy(true);
    setError("");
    const res = await fn();
    setBusy(false);
    if (!res.success) {
      setError(res.message);
      if (res.message?.includes("session has ended")) setTimeout(reset, 3000);
      return;
    }
    onOk(res);
  };

  const sendOtp = () => call(() => kioskSendOtp(s.phone), (res) => go({ step: "otp", otp: "", devCode: res.devCode ?? "" }));
  const verify = () =>
    call(() => kioskVerify(s.phone, s.otp), (res) => {
      const { ticket, patient, appointments } = res.data;
      go({ ticket, patient, appointments, step: patient ? "menu" : "register" });
    });
  const register = () => {
    const dateOfBirth = form.year && form.month && form.day ? `${form.year}-${form.month.padStart(2, "0")}-${form.day.padStart(2, "0")}` : "";
    call(() => kioskRegister(s.ticket, { firstName: form.firstName, lastName: form.lastName, gender: form.gender, dateOfBirth }), (res) =>
      go({ ticket: res.data.ticket, patient: res.data.patient, step: "department" })
    );
  };
  const finish = (res) => go({ step: "done", token: res.data });
  const checkIn = (id) => call(() => kioskCheckIn(s.ticket, id), finish);
  const walkIn = (doctorId) => call(() => kioskWalkIn(s.ticket, { doctorId }), finish);

  const department = departments.find((d) => d.id === s.departmentId);
  const back = { otp: "phone", register: "home", department: s.patient && s.appointments.length ? "menu" : "home", doctor: "department", phone: "home" }[s.step];

  return (
    <div className="flex min-h-screen select-none flex-col bg-background text-foreground print:bg-white">
      <header className="flex items-center justify-between border-b bg-card px-8 py-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-white"><Activity className="size-6" /></div>
          <div className="leading-tight">
            <div className="text-lg font-bold">{hospital}</div>
            <div className="text-sm text-muted-foreground">Self check-in · स्वयं चेक-इन</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {s.step !== "home" && (
            <button type="button" onClick={reset} className="rounded-lg border px-4 py-2 text-base font-medium">Start over</button>
          )}
          {/* Always available so staff can leave kiosk mode from any screen. */}
          <button type="button" onClick={staffSignIn} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted">
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-6 py-10">
        {back && (
          <button type="button" onClick={() => go({ step: back })} className="inline-flex w-fit items-center gap-2 text-lg text-muted-foreground print:hidden">
            <ArrowLeft className="size-5" /> Back
          </button>
        )}

        {error && <div role="alert" className="rounded-xl border-2 border-rose-300 bg-rose-50 p-4 text-center text-lg font-medium text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">{error}</div>}

        {s.step === "home" && (
          <>
            <Title en="Welcome" hi="स्वागत है" sub="Check in for your appointment, see a doctor today, or register as a new patient." />
            <div className="space-y-4">
              <BigButton icon={CalendarCheck} hint="I have a booking · मेरी बुकिंग है" onClick={() => go({ step: "phone" })}>Check in / See a doctor</BigButton>
              <BigButton icon={UserPlus} tone="secondary" hint="First visit to our hospital · पहली बार" onClick={() => go({ step: "phone" })}>New patient registration</BigButton>
            </div>
            <p className="text-center text-base text-muted-foreground">For emergencies, go straight to the Emergency department.</p>
          </>
        )}

        {s.step === "phone" && (
          <>
            <Title en="Enter your mobile number" hi="अपना मोबाइल नंबर डालें" sub="We will send a code to confirm it's you." />
            <NumberPad value={s.phone} onChange={(phone) => go({ phone })} max={10} />
            <Primary onClick={sendOtp} disabled={s.phone.length !== 10} busy={busy}>Send code</Primary>
          </>
        )}

        {s.step === "otp" && (
          <>
            <Title en="Enter the 6-digit code" hi="6 अंकों का कोड डालें" sub={`Sent by SMS to ******${s.phone.slice(-4)}${s.devCode ? ` · test code ${s.devCode}` : ""}`} />
            <NumberPad value={s.otp} onChange={(otp) => go({ otp })} max={6} masked />
            <Primary onClick={verify} disabled={s.otp.length !== 6} busy={busy}>Continue</Primary>
          </>
        )}

        {s.step === "menu" && s.patient && (
          <>
            <Title en={`Hello, ${s.patient.firstName}`} hi="नमस्ते" sub={`UHID ${s.patient.uhid}`} />
            <div className="space-y-4">
              {s.appointments.map((a) => (
                <BigButton key={a.id} icon={CalendarCheck} hint={`${a.time} · ${a.department}${a.tokenNumber ? ` · already checked in, token ${a.tokenNumber}` : ""}`} onClick={() => checkIn(a.id)} disabled={busy || Boolean(a.tokenNumber)}>
                  Check in with {a.doctor}
                </BigButton>
              ))}
              <BigButton icon={Stethoscope} tone={s.appointments.length ? "secondary" : "primary"} hint="No booking needed · बिना बुकिंग" onClick={() => go({ step: "department" })}>
                See a doctor today
              </BigButton>
            </div>
          </>
        )}

        {s.step === "register" && (
          <>
            <Title en="New patient registration" hi="नया पंजीकरण" sub="Takes less than a minute. Your UHID works at all our hospitals." />
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                {[["firstName", "First name *"], ["lastName", "Last name"]].map(([k, l]) => (
                  <label key={k} className="space-y-1.5">
                    <span className="text-base font-medium">{l}</span>
                    <input value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} autoComplete="off" className="h-14 w-full rounded-xl border-2 bg-card px-4 text-xl outline-none focus:border-primary" />
                  </label>
                ))}
              </div>
              <div className="space-y-1.5">
                <span className="text-base font-medium">Gender *</span>
                <div className="grid grid-cols-3 gap-3">
                  {[["MALE", "Male · पुरुष"], ["FEMALE", "Female · महिला"], ["OTHER", "Other · अन्य"]].map(([v, l]) => (
                    <button key={v} type="button" onClick={() => setForm((f) => ({ ...f, gender: v }))} className={cn("h-14 rounded-xl border-2 text-lg font-medium", form.gender === v ? "border-primary bg-primary/10 text-primary" : "bg-card")}>{l}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <span className="text-base font-medium">Date of birth *</span>
                <div className="grid grid-cols-3 gap-3">
                  {[["day", "Day", 2], ["month", "Month", 2], ["year", "Year", 4]].map(([k, l, n]) => (
                    <input key={k} inputMode="numeric" placeholder={l} maxLength={n} value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value.replace(/\D/g, "") }))} className="h-14 rounded-xl border-2 bg-card px-4 text-center text-xl outline-none focus:border-primary" aria-label={l} />
                  ))}
                </div>
              </div>
            </div>
            <Primary onClick={register} busy={busy}>Register</Primary>
          </>
        )}

        {s.step === "department" && (
          <>
            <Title en="Which department?" hi="कौन सा विभाग?" />
            {departments.length === 0 ? (
              <p className="text-center text-lg text-muted-foreground">No doctors are available right now. Please visit the front desk.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {departments.map((d) => (
                  <BigButton key={d.id} tone="secondary" hint={`${d.doctors.length} doctor${d.doctors.length === 1 ? "" : "s"} available`} onClick={() => go({ step: "doctor", departmentId: d.id })}>{d.name}</BigButton>
                ))}
              </div>
            )}
          </>
        )}

        {s.step === "doctor" && department && (
          <>
            <Title en="Choose a doctor" hi="डॉक्टर चुनें" sub={department.name} />
            <div className="space-y-3">
              {department.doctors.map((d) => (
                <BigButton key={d.id} icon={Stethoscope} tone="secondary" hint={d.specialization} onClick={() => walkIn(d.id)} disabled={busy}>{d.name}</BigButton>
              ))}
            </div>
          </>
        )}

        {s.step === "done" && s.token && (
          <div className="space-y-6 text-center">
            <p className="text-xl text-muted-foreground">Your token number · आपका टोकन नंबर</p>
            <div className="mx-auto flex size-48 items-center justify-center rounded-3xl bg-primary text-8xl font-bold text-white tabular-nums print:border-4 print:border-black print:bg-white print:text-black">
              {s.token.tokenNumber}
            </div>
            <div>
              <div className="text-2xl font-semibold">{s.token.doctor}</div>
              <div className="text-lg text-muted-foreground">{s.token.department}</div>
              {s.patient && <div className="mt-1 text-base text-muted-foreground">{s.patient.firstName} · UHID {s.patient.uhid}</div>}
            </div>
            <p className="text-lg">Please take a seat. Your number will appear on the screen when the doctor is ready.</p>
            <div className="flex justify-center gap-3 print:hidden">
              <button type="button" onClick={() => window.print()} className="inline-flex h-14 items-center gap-2 rounded-xl border-2 px-6 text-lg font-medium"><Printer className="size-5" /> Print slip</button>
              <button type="button" onClick={reset} className="h-14 rounded-xl bg-primary px-8 text-lg font-semibold text-white">Done</button>
            </div>
          </div>
        )}

        {busy && s.step === "home" && <Loader2 className="mx-auto size-8 animate-spin text-primary" />}
      </main>
    </div>
  );
}
