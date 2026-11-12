"use client";

import { useState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/actions/auth-reset";
import { Button } from "@/components/ui/button";
import { Field, TextInput, FormError } from "@/components/auth/fields";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Enter the email address you sign in with.");
    setBusy(true);
    const result = await requestPasswordReset(email.trim());
    setBusy(false);
    if (result.success) setSent(true);
    else setError(result.message);
  };

  return (
    <div className="space-y-7">
      <Link href="/sign-in" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to sign in
      </Link>

      {sent ? (
        <div className="space-y-4">
          <div className="flex size-11 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
            <MailCheck className="size-5" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Check your email</h1>
          <p className="text-sm text-muted-foreground">
            If an account exists for <span className="font-medium text-foreground">{email.trim()}</span>, we have sent a link to reset your password. The link expires soon, so use it right away. Check your spam folder if it hasn&apos;t arrived.
          </p>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="h-10 rounded-lg" onClick={() => setSent(false)}>Use another email</Button>
            <Link href="/sign-in" className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">Back to sign in</Link>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight">Reset your password</h1>
            <p className="text-sm text-muted-foreground">Enter your email and we&apos;ll send you a link to choose a new password. Patients who sign in with mobile OTP don&apos;t need a password.</p>
          </div>
          <FormError>{error}</FormError>
          <form onSubmit={submit} className="space-y-4" noValidate>
            <Field id="email" label="Email">
              <TextInput id="email" type="email" autoComplete="email" autoFocus placeholder="name@hospital.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Button type="submit" className="h-11 w-full rounded-lg text-[15px]" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />} {busy ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
