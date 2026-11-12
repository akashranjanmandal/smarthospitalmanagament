"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { resetPasswordWithToken } from "@/actions/auth-reset";
import { Button } from "@/components/ui/button";
import { Field, PasswordInput, FormError } from "@/components/auth/fields";
import { passwordStrength } from "@/lib/password-strength";
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";

function Notice({ icon: Icon, tone, title, children }) {
  const tones = {
    good: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    warn: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  };
  return (
    <div className="space-y-4">
      <div className={`flex size-11 items-center justify-center rounded-lg ${tones[tone]}`}><Icon className="size-5" /></div>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {children}
    </div>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!passwordStrength(password).ok) return setError("Password must be at least 6 characters.");
    if (password !== confirm) return setError("The two passwords do not match.");
    setBusy(true);
    const result = await resetPasswordWithToken({ token, newPassword: password });
    setBusy(false);
    if (!result.success) return setError(result.message);
    setDone(true);
    setTimeout(() => router.push("/sign-in"), 2500);
  };

  if (!token) {
    return (
      <Notice icon={AlertCircle} tone="warn" title="This reset link is not valid">
        <p className="text-sm text-muted-foreground">The link is incomplete or has already been used. Request a new one.</p>
        <Link href="/forgot-password" className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">Request a new link</Link>
      </Notice>
    );
  }

  if (done) {
    return (
      <Notice icon={CheckCircle2} tone="good" title="Password updated">
        <p className="text-sm text-muted-foreground">You can now sign in with your new password. Taking you to sign in…</p>
        <Link href="/sign-in" className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">Sign in now</Link>
      </Notice>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight">Choose a new password</h1>
        <p className="text-sm text-muted-foreground">At least 6 characters. Use one you don&apos;t use elsewhere.</p>
      </div>
      <FormError>{error}</FormError>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field id="password" label="New password">
          <PasswordInput id="password" autoComplete="new-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field id="confirm" label="Confirm new password">
          <PasswordInput id="confirm" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        <Button type="submit" className="h-11 w-full rounded-lg text-[15px]" disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" />} {busy ? "Saving…" : "Save new password"}
        </Button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="space-y-7">
      <Link href="/sign-in" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to sign in
      </Link>
      <Suspense fallback={<div className="flex h-40 items-center justify-center"><Loader2 className="size-6 animate-spin text-primary" /></div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
