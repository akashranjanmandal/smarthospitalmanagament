"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { patientSchema } from "@/lib/validations";
import { createPatient } from "@/actions/patients";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormSelect } from "@/components/shared/form-select";
import { toast } from "sonner";
import {
  HeartPulse,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
  UserRound,
  CalendarDays,
  PlusCircle
} from "lucide-react";

export default function NewPatientPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      gender: "",
      dateOfBirth: "",
      bloodGroup: "",
      phone: "",
      emergencyContact: "",
      address: "",
    },
  });

  const gender = watch("gender");
  const bloodGroup = watch("bloodGroup");

  const onSubmit = async (data) => {
    setLoading(true);
    const result = await createPatient(data);
    setLoading(false);
    if (result.success) {
      toast.success(result.message);
      router.push("/patients");
    } else {
      toast.error(result.message);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="Register Patient"
        description="Capture patient demographics and contact details into the system"
        breadcrumbs={[
          { label: "Patients", href: "/patients" },
          { label: "Register" },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="shadow-soft border-border/40 bg-card rounded-3xl overflow-hidden">
          <div className="gradient-primary px-8 py-6 text-white relative overflow-hidden">
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
            <div className="flex items-center gap-4 relative z-10">
              <div className="rounded-xl bg-white/15 p-3 shadow-inner">
                <UserRound className="size-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold tracking-tight">Patient Information</h2>
                <p className="text-sm font-medium text-cyan-100">Basic identity and medical baseline details</p>
              </div>
            </div>
          </div>

          <CardContent className="p-6 sm:p-8">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
              <section className="space-y-6">
                <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-primary border-b border-border/50 pb-2">
                  <UserRound className="size-4" /> Personal Details
                </div>
                
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2.5">
                    <Label className="font-semibold text-foreground/80">First Name <span className="text-destructive">*</span></Label>
                    <Input placeholder="e.g., John" {...register("firstName")} className="h-12 rounded-xl bg-background/50 focus-visible:ring-primary/30" />
                    {errors.firstName && <p className="text-sm font-medium text-destructive">{errors.firstName.message}</p>}
                  </div>
                  <div className="space-y-2.5">
                    <Label className="font-semibold text-foreground/80">Last Name <span className="text-destructive">*</span></Label>
                    <Input placeholder="e.g., Doe" {...register("lastName")} className="h-12 rounded-xl bg-background/50 focus-visible:ring-primary/30" />
                    {errors.lastName && <p className="text-sm font-medium text-destructive">{errors.lastName.message}</p>}
                  </div>
                  
                  <div className="space-y-2.5">
                    <Label className="font-semibold text-foreground/80">Gender <span className="text-destructive">*</span></Label>
                    <FormSelect
                      options={[
                        { value: "MALE", label: "Male" },
                        { value: "FEMALE", label: "Female" },
                        { value: "OTHER", label: "Other" },
                      ]}
                      value={gender}
                      onValueChange={(v) => setValue("gender", v, { shouldValidate: true })}
                      placeholder="Select gender"
                    />
                    {errors.gender && <p className="text-sm font-medium text-destructive">{errors.gender.message}</p>}
                  </div>
                  <div className="space-y-2.5">
                    <Label className="flex items-center gap-1 font-semibold text-foreground/80">
                      <CalendarDays className="size-3.5 text-primary" /> Date of Birth <span className="text-destructive">*</span>
                    </Label>
                    <Input type="date" {...register("dateOfBirth")} className="h-12 rounded-xl bg-background/50 focus-visible:ring-primary/30" />
                    {errors.dateOfBirth && <p className="text-sm font-medium text-destructive">{errors.dateOfBirth.message}</p>}
                  </div>
                  
                  <div className="space-y-2.5">
                    <Label className="font-semibold text-foreground/80">Blood Group</Label>
                    <FormSelect
                      options={["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((g) => ({ value: g, label: g }))}
                      value={bloodGroup}
                      onValueChange={(v) => setValue("bloodGroup", v)}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="space-y-2.5">
                    <Label className="flex items-center gap-1 font-semibold text-foreground/80">
                      <Mail className="size-3.5 text-primary" /> Email Account <span className="text-destructive">*</span>
                    </Label>
                    <Input type="email" placeholder="patient@email.com" {...register("email")} className="h-12 rounded-xl bg-background/50 focus-visible:ring-primary/30" />
                    {errors.email && <p className="text-sm font-medium text-destructive">{errors.email.message}</p>}
                  </div>
                </div>
              </section>

              <section className="space-y-6 pt-2">
                <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-primary border-b border-border/50 pb-2">
                  <Phone className="size-4" /> Contact Information
                </div>
                
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2.5">
                    <Label className="font-semibold text-foreground/80">Phone Number <span className="text-destructive">*</span></Label>
                    <div className="flex overflow-hidden rounded-xl border border-input focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary transition-all bg-background/50">
                      <div className="flex items-center gap-1 bg-primary/5 px-4 text-sm font-bold text-primary border-r border-input">
                        +91
                      </div>
                      <Input
                        className="h-12 border-0 rounded-none focus-visible:ring-0 bg-transparent font-medium"
                        placeholder="10-digit mobile"
                        {...register("phone")}
                      />
                    </div>
                    {errors.phone && <p className="text-sm font-medium text-destructive">{errors.phone.message}</p>}
                  </div>
                  <div className="space-y-2.5">
                    <Label className="font-semibold text-foreground/80">Emergency Contact</Label>
                    <Input placeholder="Optional name or number" {...register("emergencyContact")} className="h-12 rounded-xl bg-background/50 focus-visible:ring-primary/30" />
                  </div>
                  <div className="space-y-2.5 sm:col-span-2">
                    <Label className="flex items-center gap-1 font-semibold text-foreground/80">
                      <MapPin className="size-3.5 text-primary" /> Residential Address
                    </Label>
                    <Textarea rows={3} placeholder="House no, street, city, postal code" {...register("address")} className="rounded-xl bg-background/50 focus-visible:ring-primary/30 resize-none" />
                  </div>
                </div>
              </section>

              <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-border/40 mt-6">
                <Button type="submit" className="w-full sm:w-auto h-12 gradient-primary border-0 rounded-xl font-bold shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 px-8" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 size-5 animate-spin" /> : <PlusCircle className="mr-2 size-5" />}
                  Register Patient
                </Button>
                <Button type="button" variant="outline" className="w-full sm:w-auto h-12 rounded-xl font-bold" onClick={() => router.push("/patients")}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Sidebar Info Cards */}
        <div className="space-y-5">
          <Card className="shadow-sm border-border/40 rounded-3xl overflow-hidden bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/50">
            <CardContent className="p-6">
              <div className="inline-flex rounded-xl bg-blue-100 dark:bg-blue-900/50 p-3 text-blue-700 dark:text-blue-400 mb-4">
                <HeartPulse className="size-6" />
              </div>
              <h3 className="font-extrabold text-blue-900 dark:text-blue-100 mb-3">Quick Registration Tips</h3>
              <ul className="space-y-3 text-sm font-medium text-blue-800/80 dark:text-blue-200/80">
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span> 
                  <span>Use the patient&apos;s legal name exactly as it appears on their ID documents.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span> 
                  <span>The phone number will be used for automated appointment reminders.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-500 mt-0.5">•</span> 
                  <span>Emergency contacts are critical for reception during urgent care.</span>
                </li>
              </ul>
            </CardContent>
          </Card>
          
          <Card className="shadow-sm border-border/40 rounded-3xl overflow-hidden bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/50">
            <CardContent className="p-6">
              <div className="inline-flex rounded-xl bg-emerald-100 dark:bg-emerald-900/50 p-3 text-emerald-700 dark:text-emerald-400 mb-4">
                <ShieldCheck className="size-6" />
              </div>
              <h3 className="font-extrabold text-emerald-900 dark:text-emerald-100 mb-2">Data Privacy Secured</h3>
              <p className="text-sm font-medium text-emerald-800/80 dark:text-emerald-200/80 leading-relaxed">
                Patient records are strictly role-protected. Only authorized hospital staff can view or update this sensitive medical information.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}