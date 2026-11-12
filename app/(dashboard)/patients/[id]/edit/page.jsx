"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { patientSchema } from "@/lib/validations";
import { getPatientById, updatePatient } from "@/actions/patients";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, UserRound, Save, ArrowLeft } from "lucide-react";
import { PageLoader } from "@/components/shared/page-loader";
import { FormSelect } from "@/components/shared/form-select";
import { format } from "date-fns";

export default function EditPatientPage() {
  const router = useRouter();
  const params = useParams();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(patientSchema),
  });

  useEffect(() => {
    getPatientById(params.id).then((result) => {
      if (result.success) {
        const p = result.data;
        reset({
          firstName: p.firstName,
          lastName: p.lastName,
          gender: p.gender,
          dateOfBirth: format(new Date(p.dateOfBirth), "yyyy-MM-dd"),
          bloodGroup: p.bloodGroup || "",
          phone: p.phone,
          emergencyContact: p.emergencyContact || "",
          address: p.address || "",
        });
      } else {
        toast.error(result.message);
        router.push("/patients");
      }
      setFetching(false);
    });
  }, [params.id, reset, router]);

  const onSubmit = async (data) => {
    setLoading(true);
    const result = await updatePatient(params.id, data);
    if (result.success) {
      toast.success(result.message);
      router.push("/patients");
    } else {
      toast.error(result.message);
    }
    setLoading(false);
  };

  if (fetching) {
    return (
      <PageLoader
        messages={[
          "Loading patient data…",
          "Retrieving health information…",
          "Preparing the edit form…",
          "Almost ready…",
        ]}
      />
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-2">
        <Button variant="ghost" size="icon" className="rounded-full hover:bg-muted" onClick={() => router.back()}>
          <ArrowLeft className="size-5" />
        </Button>
        <PageHeader
          title="Edit Patient"
          description="Update personal and demographic information"
          breadcrumbs={[
            { label: "Patients", href: "/patients" },
            { label: "Edit Patient" },
          ]}
          className="m-0 p-0"
        />
      </div>

      <Card className="shadow-soft border-border/40 bg-card rounded-3xl overflow-hidden">
        <CardHeader className="bg-primary/5 border-b border-primary/10 pb-4">
          <CardTitle className="text-lg font-bold flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl text-primary"><UserRound className="size-5" /></div>
            Patient Information
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 sm:p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2.5">
                <Label htmlFor="firstName" className="font-semibold text-foreground/80">First Name <span className="text-destructive">*</span></Label>
                <Input id="firstName" {...register("firstName")} className="h-12 rounded-xl bg-background/50 focus-visible:ring-primary/30" />
                {errors.firstName && <p className="text-sm font-medium text-destructive animate-in slide-in-from-top-1">{errors.firstName.message}</p>}
              </div>
              <div className="space-y-2.5">
                <Label htmlFor="lastName" className="font-semibold text-foreground/80">Last Name <span className="text-destructive">*</span></Label>
                <Input id="lastName" {...register("lastName")} className="h-12 rounded-xl bg-background/50 focus-visible:ring-primary/30" />
                {errors.lastName && <p className="text-sm font-medium text-destructive animate-in slide-in-from-top-1">{errors.lastName.message}</p>}
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
                  onValueChange={(val) => setValue("gender", val)}
                  placeholder="Select gender"
                />
                {errors.gender && <p className="text-sm font-medium text-destructive animate-in slide-in-from-top-1">{errors.gender.message}</p>}
              </div>
              <div className="space-y-2.5">
                <Label htmlFor="dateOfBirth" className="font-semibold text-foreground/80">Date of Birth <span className="text-destructive">*</span></Label>
                <Input id="dateOfBirth" type="date" {...register("dateOfBirth")} className="h-12 rounded-xl bg-background/50 focus-visible:ring-primary/30" />
                {errors.dateOfBirth && <p className="text-sm font-medium text-destructive animate-in slide-in-from-top-1">{errors.dateOfBirth.message}</p>}
              </div>
            </div>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border/50" /></div>
              <div className="relative flex justify-center text-xs font-bold uppercase tracking-wider">
                <span className="bg-card px-4 text-muted-foreground">Contact & Health</span>
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2.5">
                <Label htmlFor="phone" className="font-semibold text-foreground/80">Phone Number <span className="text-destructive">*</span></Label>
                <Input id="phone" {...register("phone")} className="h-12 rounded-xl bg-background/50 focus-visible:ring-primary/30" />
                {errors.phone && <p className="text-sm font-medium text-destructive animate-in slide-in-from-top-1">{errors.phone.message}</p>}
              </div>
              <div className="space-y-2.5">
                <Label htmlFor="bloodGroup" className="font-semibold text-foreground/80">Blood Group</Label>
                <Input id="bloodGroup" placeholder="e.g., A+, B-, O+" {...register("bloodGroup")} className="h-12 rounded-xl bg-background/50 focus-visible:ring-primary/30 uppercase" />
              </div>
            </div>

            <div className="space-y-2.5">
              <Label htmlFor="emergencyContact" className="font-semibold text-foreground/80">Emergency Contact</Label>
              <Input id="emergencyContact" {...register("emergencyContact")} className="h-12 rounded-xl bg-background/50 focus-visible:ring-primary/30" placeholder="Name and Phone (Optional)" />
            </div>

            <div className="space-y-2.5">
              <Label htmlFor="address" className="font-semibold text-foreground/80">Address</Label>
              <Textarea id="address" rows={3} {...register("address")} className="rounded-xl bg-background/50 focus-visible:ring-primary/30 resize-none" placeholder="Full residential address..." />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-border/40 mt-6">
              <Button type="submit" disabled={loading} className="w-full sm:w-auto h-12 gradient-primary border-0 rounded-xl font-bold shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 px-8">
                {loading ? <Loader2 className="mr-2 size-5 animate-spin" /> : <Save className="mr-2 size-5" />}
                Update Patient Profile
              </Button>
              <Button type="button" variant="outline" className="w-full sm:w-auto h-12 rounded-xl font-bold" onClick={() => router.push("/patients")}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}