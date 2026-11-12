"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/auth/brand";
import { Field, TextInput, PasswordInput, PhoneInput, FormError, Divider, GoogleButton } from "@/components/auth/fields";
import { verifyRegistrationCode } from "@/actions/registration-codes";
import { roleFromRegistrationCode, normalizeRegistrationCode } from "@/lib/registration-code";
import { passwordStrength } from "@/lib/password-strength";
import { getRoleLabel } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { ArrowLeft, BadgeCheck, Building2, ChevronRight, Loader2, UserRound } from "lucide-react";

async function register(body) {
  const res = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return res.json();
}

function StrengthMeter({ password }) {
  if (!password) return null;
  const { score, label } = passwordStrength(password);
  const colors = ["bg-rose-500", "bg-rose-500", "bg-amber-500", "bg-sky-500", "bg-emerald-500"];
  return (
    <div className="flex items-center gap-2" aria-live="polite">
      <div className="flex flex-1 gap-1">
        {[1, 2, 3, 4].map((i) => <span key={i} className={cn("h-1 flex-1 rounded-full", i <= score ? colors[score] : "bg-muted")} />)}
      </div>
      <span className="w-16 text-right text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function BackButton({ onClick }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" /> Back
    </button>
  );
}

/** Name, contact and password — shared by patient and staff sign-up. */
function AccountFields({ values, set, phoneRequired }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="firstName" label="First name" required>
          <TextInput id="firstName" autoComplete="given-name" autoFocus value={values.firstName} onChange={set("firstName")} />
        </Field>
        <Field id="lastName" label="Last name">
          <TextInput id="lastName" autoComplete="family-name" value={values.lastName} onChange={set("lastName")} />
        </Field>
      </div>
      <Field id="phone" label="Mobile number" required={phoneRequired}>
        <PhoneInput id="phone" value={values.phone} onChange={(v) => set("phone")({ target: { value: v } })} />
      </Field>
      <Field id="email" label="Email" required>
        <TextInput id="email" type="email" autoComplete="email" placeholder="name@example.com" value={values.email} onChange={set("email")} />
      </Field>
      <Field id="password" label="Create password" required hint="At least 6 characters. Longer, with numbers and capitals, is stronger.">
        <PasswordInput id="password" autoComplete="new-password" value={values.password} onChange={set("password")} />
        <StrengthMeter password={values.password} />
      </Field>
    </>
  );
}

function useAccountForm() {
  const [values, setValues] = useState({ firstName: "", lastName: "", phone: "", email: "", password: "" });
  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));
  const problem = (phoneRequired) => {
    if (!values.firstName.trim()) return "Enter your first name.";
    if (phoneRequired && values.phone.length !== 10) return "Enter your 10-digit mobile number.";
    if (values.phone && values.phone.length !== 10) return "Mobile number must be 10 digits.";
    if (!/^\S+@\S+\.\S+$/.test(values.email.trim())) return "Enter a valid email address.";
    if (!passwordStrength(values.password).ok) return "Password must be at least 6 characters.";
    return "";
  };
  return { values, set, problem };
}

function PatientSignUp({ onBack }) {
  const router = useRouter();
  const { values, set, problem } = useAccountForm();
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    const issue = problem(true) || (!consent ? "Please agree to how your health information is used." : "");
    if (issue) return setError(issue);
    setError("");
    setBusy(true);
    try {
      const data = await register({ ...values, email: values.email.trim(), role: "PATIENT" });
      if (data.success) return router.push("/dashboard");
      setError(data.message || "We could not create your account.");
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    }
    setBusy(false);
  };

  return (
    <div className="space-y-6">
      <BackButton onClick={onBack} />
      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight">Create your patient account</h1>
        <p className="text-sm text-muted-foreground">Book visits and see your reports, prescriptions and bills at any of our hospitals.</p>
      </div>
      <FormError>{error}</FormError>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <AccountFields values={values} set={set} phoneRequired />
        <label className="flex items-start gap-2.5 text-sm text-muted-foreground">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]" />
          <span>I agree that the hospital may store and use my health information to provide my care, as required under the Digital Personal Data Protection Act, 2023.</span>
        </label>
        <Button type="submit" className="h-11 w-full rounded-lg text-[15px]" disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" />} {busy ? "Creating account…" : "Create account"}
        </Button>
      </form>
      <Divider>or</Divider>
      <GoogleButton>Sign up with Google</GoogleButton>
    </div>
  );
}

function StaffSignUp({ onBack }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [verified, setVerified] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { values, set, problem } = useAccountForm();
  const detectedRole = roleFromRegistrationCode(code);

  const verify = async (e) => {
    e.preventDefault();
    setError("");
    if (!detectedRole) return setError("That doesn't look like a registration code. It looks like NUR-84KM-PX21 — ask your hospital administrator.");
    setBusy(true);
    const result = await verifyRegistrationCode(normalizeRegistrationCode(code), detectedRole);
    setBusy(false);
    if (!result.valid) return setError(result.error);
    setVerified({ ...result, code: normalizeRegistrationCode(code) });
  };

  const submit = async (e) => {
    e.preventDefault();
    const issue = problem(false);
    if (issue) return setError(issue);
    setError("");
    setBusy(true);
    try {
      const data = await register({ ...values, email: values.email.trim(), role: verified.role, registrationCodeId: verified.codeId });
      if (data.success) return router.push("/dashboard");
      setError(data.message || "We could not create your account.");
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    }
    setBusy(false);
  };

  if (!verified) {
    return (
      <div className="space-y-6">
        <BackButton onClick={onBack} />
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Step 1 of 2</p>
          <h1 className="text-2xl font-bold tracking-tight">Enter your registration code</h1>
          <p className="text-sm text-muted-foreground">Your hospital administrator gives each new staff member a one-time code. It sets your role and department.</p>
        </div>
        <FormError>{error}</FormError>
        <form onSubmit={verify} className="space-y-4" noValidate>
          <Field id="code" label="Registration code" hint={detectedRole ? `This code is for: ${getRoleLabel(detectedRole)}` : "Example: NUR-84KM-PX21"}>
            <TextInput
              id="code"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              placeholder="XXX-XXXX-XXXX"
              value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(""); }}
              onBlur={() => setCode((c) => normalizeRegistrationCode(c))}
              className="text-center font-mono text-lg tracking-[0.2em]"
            />
          </Field>
          <Button type="submit" className="h-11 w-full rounded-lg text-[15px]" disabled={busy || !code.trim()}>
            {busy && <Loader2 className="size-4 animate-spin" />} {busy ? "Checking…" : "Continue"}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackButton onClick={() => { setVerified(null); setError(""); }} />
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Step 2 of 2</p>
        <h1 className="text-2xl font-bold tracking-tight">Your staff account</h1>
      </div>
      <div className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
        <BadgeCheck className="size-4 shrink-0" />
        <span>Code <span className="font-mono font-semibold">{verified.code}</span> verified — you are joining as <strong>{getRoleLabel(verified.role)}</strong>.</span>
      </div>
      <FormError>{error}</FormError>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <AccountFields values={values} set={set} />
        <Button type="submit" className="h-11 w-full rounded-lg text-[15px]" disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" />} {busy ? "Creating account…" : "Create staff account"}
        </Button>
      </form>
    </div>
  );
}

const CHOICES = [
  { type: "patient", icon: UserRound, title: "I'm a patient", text: "Book appointments, see reports, prescriptions, bills and discharge summaries." },
  { type: "staff", icon: Building2, title: "I'm hospital staff", text: "Doctors, nurses, pharmacists, lab and kitchen staff, front office, insurance desk, ward attendants and administrators. You'll need a registration code." },
];

function SignUpFlow() {
  const params = useSearchParams();
  const initial = ["patient", "staff"].includes(params.get("type")) ? params.get("type") : null;
  const [type, setType] = useState(initial);

  if (type === "patient") return <PatientSignUp onBack={() => setType(null)} />;
  if (type === "staff") return <StaffSignUp onBack={() => setType(null)} />;

  return (
    <div className="space-y-7">
      <Brand className="lg:hidden" />
      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight">Create an account</h1>
        <p className="text-sm text-muted-foreground">Choose the option that describes you.</p>
      </div>
      <div className="space-y-3">
        {CHOICES.map(({ type: t, icon: Icon, title, text }) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className="group flex w-full items-center gap-4 rounded-xl border bg-background p-4 text-left transition-colors hover:border-primary/50 hover:bg-primary/[0.03] focus-visible:outline-2 focus-visible:outline-primary"
          >
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{title}</div>
              <p className="text-sm text-muted-foreground">{text}</p>
            </div>
            <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </button>
        ))}
      </div>
      <p className="border-t pt-5 text-sm text-muted-foreground">
        Already have an account? <Link href="/sign-in" className="font-medium text-primary hover:underline">Sign in</Link>
      </p>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="flex h-64 items-center justify-center"><Loader2 className="size-6 animate-spin text-primary" /></div>}>
      <SignUpFlow />
    </Suspense>
  );
}
