"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/auth/brand";
import { Field, TextInput, PasswordInput, PhoneInput, FormError, Divider, Segmented, GoogleButton } from "@/components/auth/fields";
import { Loader2, Mail, Smartphone } from "lucide-react";

const METHODS = [
  { value: "email", label: "Email", icon: Mail },
  { value: "phone", label: "Mobile OTP", icon: Smartphone },
];

async function post(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return res.json();
}

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("redirect") || "/dashboard";

  const [method, setMethod] = useState("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [devCode, setDevCode] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(params.get("error") ? "Google sign-in did not complete. Please try again." : "");
  const timer = useRef(null);

  useEffect(() => () => clearInterval(timer.current), []);

  const startResendTimer = () => {
    clearInterval(timer.current);
    setResendIn(30);
    timer.current = setInterval(() => setResendIn((t) => (t <= 1 ? (clearInterval(timer.current), 0) : t - 1)), 1000);
  };

  const finish = (data) => router.push(data.needsProfile ? "/complete-profile" : next);

  const switchMethod = (m) => {
    setMethod(m);
    setError("");
  };

  const signInWithEmail = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) return setError("Enter your email and password.");
    setBusy(true);
    try {
      const data = await post("/api/auth/login", { email: email.trim(), password });
      if (data.success) return finish(data);
      setError(data.message || "Email or password is incorrect.");
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    }
    setBusy(false);
  };

  const sendOtp = async () => {
    setError("");
    if (phone.length !== 10) return setError("Enter your 10-digit mobile number.");
    setBusy(true);
    try {
      const data = await post("/api/auth/otp/send", { phone });
      if (data.success) {
        setOtpSent(true);
        setOtp("");
        setDevCode(data.devCode || "");
        startResendTimer();
      } else {
        setError(data.message || "Could not send the code. Please try again.");
      }
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    }
    setBusy(false);
  };

  const verifyOtp = async (e) => {
    e.preventDefault();
    setError("");
    if (otp.length !== 6) return setError("Enter the 6-digit code sent to your phone.");
    setBusy(true);
    try {
      const data = await post("/api/auth/otp/verify", { phone, otp });
      if (data.success) return finish(data);
      setError(data.message || "That code is not correct or has expired.");
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    }
    setBusy(false);
  };

  return (
    <div className="space-y-7">
      <Brand className="lg:hidden" />

      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">Hospital staff and patients sign in here.</p>
      </div>

      <div className="space-y-5">
        <Segmented label="Sign-in method" value={method} onChange={switchMethod} options={METHODS} />

        <FormError>{error}</FormError>

        {method === "email" ? (
          <form onSubmit={signInWithEmail} className="space-y-4" noValidate>
            <Field id="email" label="Email">
              <TextInput id="email" type="email" autoComplete="username" autoFocus placeholder="name@hospital.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field
              id="password"
              label="Password"
              action={<Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">Forgot password?</Link>}
            >
              <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <Button type="submit" className="h-11 w-full rounded-lg text-[15px]" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />} {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        ) : (
          <form onSubmit={otpSent ? verifyOtp : (e) => { e.preventDefault(); sendOtp(); }} className="space-y-4" noValidate>
            <Field id="phone" label="Mobile number" hint={otpSent ? null : "We'll send a 6-digit code by SMS."}>
              <PhoneInput id="phone" value={phone} onChange={setPhone} disabled={otpSent} autoFocus />
            </Field>
            {otpSent && (
              <Field
                id="otp"
                label="Verification code"
                hint={devCode ? `Development mode: your code is ${devCode}` : `Sent to +91 ${phone}`}
                action={
                  <button type="button" className="text-xs font-medium text-primary hover:underline disabled:text-muted-foreground disabled:no-underline" onClick={sendOtp} disabled={resendIn > 0 || busy}>
                    {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
                  </button>
                }
              >
                <TextInput
                  id="otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  maxLength={6}
                  placeholder="••••••"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="text-center text-lg font-semibold tracking-[0.5em]"
                />
              </Field>
            )}
            <Button type="submit" className="h-11 w-full rounded-lg text-[15px]" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />} {otpSent ? (busy ? "Verifying…" : "Verify and sign in") : busy ? "Sending…" : "Send code"}
            </Button>
            {otpSent && (
              <button type="button" className="w-full text-center text-sm text-muted-foreground hover:text-foreground" onClick={() => { setOtpSent(false); setOtp(""); setError(""); }}>
                Use a different number
              </button>
            )}
          </form>
        )}

        <Divider>or</Divider>
        <GoogleButton />
      </div>

      <div className="space-y-1 border-t pt-5 text-sm">
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
    <Suspense fallback={<div className="flex h-64 items-center justify-center"><Loader2 className="size-6 animate-spin text-primary" /></div>}>
      <SignInForm />
    </Suspense>
  );
}
