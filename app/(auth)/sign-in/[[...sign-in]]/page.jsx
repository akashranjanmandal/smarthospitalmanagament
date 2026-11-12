"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, TextInput, PasswordInput, FormError } from "@/components/auth/fields";
import { Loader2 } from "lucide-react";

async function post(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return res.json();
}

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("redirect") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) return setError("Enter your email address.");
    if (!password) return setError("Enter your password.");
    setBusy(true);
    try {
      const data = await post("/api/auth/login", { email: email.trim(), password });
      if (data.success) return router.push(data.needsProfile ? "/complete-profile" : next);
      setError(data.message || "That email or password is incorrect.");
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    }
    setBusy(false);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">Hospital staff and patients sign in here.</p>
      </div>

      <form onSubmit={submit} className="space-y-4" noValidate>
        <FormError>{error}</FormError>
        <Field id="email" label="Email">
          <TextInput id="email" type="email" autoComplete="username" autoFocus placeholder="name@hospital.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field id="password" label="Password" action={<Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">Forgot password?</Link>}>
          <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Button type="submit" className="h-11 w-full rounded-lg text-[15px]" disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" />} {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <div className="space-y-1.5 border-t pt-5 text-sm">
        <p className="text-muted-foreground">
          New patient? <Link href="/sign-up?type=patient" className="font-medium text-primary hover:underline">Create your account</Link>
        </p>
        <p className="text-muted-foreground">
          Joining as hospital staff? <Link href="/sign-up?type=staff" className="font-medium text-primary hover:underline">Use your registration code</Link>
        </p>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="flex h-48 items-center justify-center"><Loader2 className="size-6 animate-spin text-primary" /></div>}>
      <SignInForm />
    </Suspense>
  );
}
