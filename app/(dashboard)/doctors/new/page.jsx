"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createDoctor } from "@/actions/doctors";
import { getAllDepartments } from "@/actions/departments";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, PlusCircle, Stethoscope } from "lucide-react";
import { FormSelect } from "@/components/shared/form-select";

const createDoctorSchema = z.object({
  email: z.string().email("Valid email is required"),
  firstName: z.string().min(2, "First name is required").max(50),
  lastName: z.string().min(2, "Last name is required").max(50),
  departmentId: z.string().min(1, "Department is required"),
  specialization: z.string().min(2, "Specialization is required").max(100),
  qualification: z.string().min(2, "Qualification is required").max(200),
  experience: z.coerce.number().min(0).max(70),
  phone: z.string().min(10, "Phone must be at least 10 digits").max(15),
});

export default function NewDoctorPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState([]);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(createDoctorSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      departmentId: "",
      specialization: "",
      qualification: "",
      experience: 0,
      phone: "",
    },
  });

  useEffect(() => {
    getAllDepartments().then((res) => {
      if (res.success) setDepartments(res.data);
    });
  }, []);

  const onSubmit = async (data) => {
    setLoading(true);
    const result = await createDoctor(data);
    if (result.success) {
      toast.success(result.message);
      router.push("/doctors");
    } else {
      toast.error(result.message);
    }
    setLoading(false);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="Register New Doctor"
        description="Add a new medical professional to the hospital system"
        breadcrumbs={[
          { label: "Doctors", href: "/doctors" },
          { label: "Register Doctor" },
        ]}
      />

      <Card className="shadow-soft border-border/40 bg-card rounded-3xl overflow-hidden">
        <CardHeader className="bg-primary/5 border-b border-primary/10 pb-4">
          <CardTitle className="text-lg font-bold flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl text-primary"><Stethoscope className="size-5" /></div>
            Doctor Information
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 sm:p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            {/* Basic Info */}
            <div className="space-y-6">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b border-border/50 pb-2">Personal Details</h3>
              <div className="grid gap-6 sm:grid-cols-3">
                <div className="space-y-2.5">
                  <Label htmlFor="firstName" className="font-semibold text-foreground/80">First Name <span className="text-destructive">*</span></Label>
                  <Input id="firstName" placeholder="e.g. John" {...register("firstName")} className="h-12 rounded-xl bg-background/50 focus-visible:ring-primary/30" />
                  {errors.firstName && <p className="text-sm font-medium text-destructive">{errors.firstName.message}</p>}
                </div>
                <div className="space-y-2.5">
                  <Label htmlFor="lastName" className="font-semibold text-foreground/80">Last Name <span className="text-destructive">*</span></Label>
                  <Input id="lastName" placeholder="e.g. Doe" {...register("lastName")} className="h-12 rounded-xl bg-background/50 focus-visible:ring-primary/30" />
                  {errors.lastName && <p className="text-sm font-medium text-destructive">{errors.lastName.message}</p>}
                </div>
                <div className="space-y-2.5">
                  <Label htmlFor="email" className="font-semibold text-foreground/80">Email <span className="text-destructive">*</span></Label>
                  <Input id="email" type="email" placeholder="doctor@hospital.com" {...register("email")} className="h-12 rounded-xl bg-background/50 focus-visible:ring-primary/30" />
                  {errors.email && <p className="text-sm font-medium text-destructive">{errors.email.message}</p>}
                </div>
              </div>
            </div>

            {/* Professional Info */}
            <div className="space-y-6">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b border-border/50 pb-2">Professional Details</h3>
              
              <div className="space-y-2.5 max-w-md">
                <Label className="font-semibold text-foreground/80">Department <span className="text-destructive">*</span></Label>
                <FormSelect
                  options={departments.map((d) => ({ value: d.id, label: d.name }))}
                  onValueChange={(val) => setValue("departmentId", val)}
                  placeholder="Select hospital department"
                />
                {errors.departmentId && <p className="text-sm font-medium text-destructive">{errors.departmentId.message}</p>}
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2.5">
                  <Label htmlFor="specialization" className="font-semibold text-foreground/80">Specialization <span className="text-destructive">*</span></Label>
                  <Input id="specialization" placeholder="e.g., Cardiologist" {...register("specialization")} className="h-12 rounded-xl bg-background/50 focus-visible:ring-primary/30" />
                  {errors.specialization && <p className="text-sm font-medium text-destructive">{errors.specialization.message}</p>}
                </div>
                <div className="space-y-2.5">
                  <Label htmlFor="qualification" className="font-semibold text-foreground/80">Qualification <span className="text-destructive">*</span></Label>
                  <Input id="qualification" placeholder="e.g., MD, MBBS" {...register("qualification")} className="h-12 rounded-xl bg-background/50 focus-visible:ring-primary/30" />
                  {errors.qualification && <p className="text-sm font-medium text-destructive">{errors.qualification.message}</p>}
                </div>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2.5">
                  <Label htmlFor="experience" className="font-semibold text-foreground/80">Experience (years)</Label>
                  <Input id="experience" type="number" min="0" {...register("experience")} className="h-12 rounded-xl bg-background/50 focus-visible:ring-primary/30" />
                  {errors.experience && <p className="text-sm font-medium text-destructive">{errors.experience.message}</p>}
                </div>
                <div className="space-y-2.5">
                  <Label htmlFor="phone" className="font-semibold text-foreground/80">Contact Phone <span className="text-destructive">*</span></Label>
                  <Input id="phone" placeholder="Phone number" {...register("phone")} className="h-12 rounded-xl bg-background/50 focus-visible:ring-primary/30" />
                  {errors.phone && <p className="text-sm font-medium text-destructive">{errors.phone.message}</p>}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-border/40 mt-6">
              <Button type="submit" disabled={loading} className="w-full sm:w-auto h-12 gradient-primary border-0 rounded-xl font-bold shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 px-8">
                {loading ? <Loader2 className="mr-2 size-5 animate-spin" /> : <PlusCircle className="mr-2 size-5" />}
                Register Doctor
              </Button>
              <Button type="button" variant="outline" className="w-full sm:w-auto h-12 rounded-xl font-bold" onClick={() => router.push("/doctors")}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}