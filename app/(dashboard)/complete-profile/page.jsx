"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FormSelect } from "@/components/shared/form-select";
import { UserRound, Loader2, MapPin, CalendarDays, Activity, CheckCircle2, Mail } from "lucide-react";
import { toast } from "sonner";

export default function CompleteProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    city: "",
    gender: "",
    dateOfBirth: "",
    email: "",
    bloodGroup: "",
    emergencyContact: "",
  });
  const [errors, setErrors] = useState({});

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const validate = () => {
    const next = {};
    if (!form.firstName.trim()) next.firstName = "Enter full first name";
    if (!form.gender) next.gender = "Select gender";
    if (!form.dateOfBirth) next.dateOfBirth = "Enter date of birth";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      next.email = "Enter a valid email address";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      toast.error("Please complete required details");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Profile completed");
        if (typeof window !== "undefined") {
          window.location.href = "/dashboard";
        } else {
          router.push("/dashboard");
        }
      } else {
        toast.error(data.message || "Failed to save profile");
      }
    } catch {
      toast.error("Failed to save profile");
    }
    setLoading(false);
  };

  return (
    <div className="mx-auto max-w-2xl py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className="shadow-hover border-border/40 bg-card rounded-[2rem] overflow-hidden">
        {/* Modern Medical Header */}
        <div className="gradient-primary px-8 py-10 text-white relative overflow-hidden">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-cyan-400/20 blur-2xl" />
          
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="mb-5 inline-flex rounded-2xl bg-white/10 p-4 shadow-inner backdrop-blur-sm border border-white/20">
              <UserRound className="size-8 text-cyan-100" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">Complete Your Profile</h1>
            <p className="mt-2 text-base text-cyan-100/90 max-w-md font-medium">
              Tell us a few details so we can personalize your digital healthcare experience.
            </p>
          </div>
        </div>

        <CardContent className="p-8">
          <form onSubmit={onSubmit} className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2.5">
                <Label className="font-semibold text-foreground/80">First Name <span className="text-destructive">*</span></Label>
                <Input value={form.firstName} onChange={(e) => setField("firstName", e.target.value)} placeholder="Enter first name" className="h-12 rounded-xl bg-background/50 focus-visible:ring-primary/30" />
                {errors.firstName && <p className="text-sm font-medium text-destructive animate-in slide-in-from-top-1">{errors.firstName}</p>}
              </div>
              <div className="space-y-2.5">
                <Label className="font-semibold text-foreground/80">Last Name</Label>
                <Input value={form.lastName} onChange={(e) => setField("lastName", e.target.value)} placeholder="Enter last name" className="h-12 rounded-xl bg-background/50 focus-visible:ring-primary/30" />
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2.5">
                <Label className="font-semibold text-foreground/80">Gender <span className="text-destructive">*</span></Label>
                <FormSelect
                  options={[
                    { value: "MALE", label: "Male" },
                    { value: "FEMALE", label: "Female" },
                    { value: "OTHER", label: "Other" },
                  ]}
                  value={form.gender}
                  onValueChange={(v) => setField("gender", v)}
                  placeholder="Select gender"
                />
                {errors.gender && <p className="text-sm font-medium text-destructive animate-in slide-in-from-top-1">{errors.gender}</p>}
              </div>
              <div className="space-y-2.5">
                <Label className="flex items-center gap-1.5 font-semibold text-foreground/80">
                  <CalendarDays className="size-4 text-primary" /> Date of Birth <span className="text-destructive">*</span>
                </Label>
                <Input type="date" value={form.dateOfBirth} onChange={(e) => setField("dateOfBirth", e.target.value)} className="h-12 rounded-xl bg-background/50 focus-visible:ring-primary/30" />
                {errors.dateOfBirth && <p className="text-sm font-medium text-destructive animate-in slide-in-from-top-1">{errors.dateOfBirth}</p>}
              </div>
            </div>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border/50" /></div>
              <div className="relative flex justify-center text-xs font-bold uppercase tracking-wider">
                <span className="bg-card px-4 text-muted-foreground">Contact & Medical</span>
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2.5">
                <Label className="flex items-center gap-1.5 font-semibold text-foreground/80">
                  <MapPin className="size-4 text-primary" /> City
                </Label>
                <Input value={form.city} onChange={(e) => setField("city", e.target.value)} placeholder="e.g. Mumbai" className="h-12 rounded-xl bg-background/50 focus-visible:ring-primary/30" />
              </div>
              <div className="space-y-2.5">
                <Label className="flex items-center gap-1.5 font-semibold text-foreground/80">
                  <Mail className="size-4 text-primary" /> Email Address
                </Label>
                <Input 
                  type="email"
                  value={form.email} 
                  onChange={(e) => setField("email", e.target.value)} 
                  placeholder="e.g. name@example.com" 
                  className="h-12 rounded-xl bg-background/50 focus-visible:ring-primary/30" 
                />
                {errors.email && <p className="text-sm font-medium text-destructive animate-in slide-in-from-top-1">{errors.email}</p>}
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2.5">
                <Label className="flex items-center gap-1.5 font-semibold text-foreground/80">
                  <Activity className="size-4 text-primary" /> Blood Group
                </Label>
                <FormSelect
                  options={["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((g) => ({ value: g, label: g }))}
                  value={form.bloodGroup}
                  onValueChange={(v) => setField("bloodGroup", v)}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2.5">
                <Label className="font-semibold text-foreground/80">Emergency Contact</Label>
                <Input value={form.emergencyContact} onChange={(e) => setField("emergencyContact", e.target.value)} placeholder="Name / Phone (Optional)" className="h-12 rounded-xl bg-background/50 focus-visible:ring-primary/30" />
              </div>
            </div>

            <div className="pt-4">
              <Button type="submit" className="w-full h-14 text-base font-bold rounded-xl gradient-primary border-0 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all" disabled={loading}>
                {loading ? <Loader2 className="mr-2 size-5 animate-spin" /> : <CheckCircle2 className="mr-2 size-5" />}
                Save & Complete Profile
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}