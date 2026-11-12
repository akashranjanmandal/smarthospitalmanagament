"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { doctorSchema } from "@/lib/validations";
import { getDoctorById, updateDoctor } from "@/actions/doctors";
import { getAllDepartments } from "@/actions/departments";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, UserCog, Save } from "lucide-react";
import { FormSelect } from "@/components/shared/form-select";

export default function EditDoctorPage() {
  const router = useRouter();
  const params = useParams();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [departments, setDepartments] = useState([]);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(doctorSchema.omit({ email: true, firstName: true, lastName: true })),
    defaultValues: {
      departmentId: "",
      specialization: "",
      qualification: "",
      experience: 0,
      phone: "",
      available: true,
    },
  });

  useEffect(() => {
    Promise.all([
      getDoctorById(params.id),
      getAllDepartments(),
    ]).then(([docRes, deptRes]) => {
      if (docRes.success) {
        const d = docRes.data;
        reset({
          departmentId: d.departmentId,
          specialization: d.specialization,
          qualification: d.qualification,
          experience: d.experience,
          phone: d.phone,
          available: d.available,
        });
      } else {
        toast.error(docRes.message);
        router.push("/doctors");
      }
      if (deptRes.success) setDepartments(deptRes.data);
      setFetching(false);
    });
  }, [params.id, reset, router]);

  const onSubmit = async (data) => {
    setLoading(true);
    const result = await updateDoctor(params.id, data);
    if (result.success) {
      toast.success(result.message);
      router.push("/doctors");
    } else {
      toast.error(result.message);
    }
    setLoading(false);
  };

  if (fetching) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4 animate-in fade-in">
        <Loader2 className="size-10 animate-spin text-primary" />
        <p className="text-muted-foreground font-medium animate-pulse">Loading doctor profile...</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Edit Doctor Profile"
        description="Update doctor's specialization, experience, and contact details"
        breadcrumbs={[
          { label: "Doctors", href: "/doctors" },
          { label: "Edit Doctor" },
        ]}
      />

      <Card className="shadow-soft border-border/40 bg-card rounded-3xl overflow-hidden">
        <CardHeader className="bg-muted/20 border-b border-border/30 pb-4">
          <CardTitle className="text-lg font-bold flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl text-primary"><UserCog className="size-5" /></div>
            Professional Information
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 sm:p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2.5">
              <Label className="font-semibold text-foreground/80">Department <span className="text-destructive">*</span></Label>
              <FormSelect
                options={departments.map((d) => ({ value: d.id, label: d.name }))}
                onValueChange={(val) => setValue("departmentId", val)}
                placeholder="Select assigned department"
              />
              {errors.departmentId && <p className="text-sm font-medium text-destructive animate-in slide-in-from-top-1">{errors.departmentId.message}</p>}
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2.5">
                <Label htmlFor="specialization" className="font-semibold text-foreground/80">Specialization <span className="text-destructive">*</span></Label>
                <Input id="specialization" {...register("specialization")} className="h-12 rounded-xl bg-background/50 focus-visible:ring-primary/30" />
                {errors.specialization && <p className="text-sm font-medium text-destructive animate-in slide-in-from-top-1">{errors.specialization.message}</p>}
              </div>
              <div className="space-y-2.5">
                <Label htmlFor="qualification" className="font-semibold text-foreground/80">Qualification <span className="text-destructive">*</span></Label>
                <Input id="qualification" {...register("qualification")} className="h-12 rounded-xl bg-background/50 focus-visible:ring-primary/30" />
                {errors.qualification && <p className="text-sm font-medium text-destructive animate-in slide-in-from-top-1">{errors.qualification.message}</p>}
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2.5">
                <Label htmlFor="experience" className="font-semibold text-foreground/80">Experience (years)</Label>
                <Input id="experience" type="number" min="0" {...register("experience")} className="h-12 rounded-xl bg-background/50 focus-visible:ring-primary/30" />
              </div>
              <div className="space-y-2.5">
                <Label htmlFor="phone" className="font-semibold text-foreground/80">Phone Number <span className="text-destructive">*</span></Label>
                <Input id="phone" {...register("phone")} className="h-12 rounded-xl bg-background/50 focus-visible:ring-primary/30" />
                {errors.phone && <p className="text-sm font-medium text-destructive animate-in slide-in-from-top-1">{errors.phone.message}</p>}
              </div>
            </div>
            
            <div className="space-y-2.5">
              <Label className="font-semibold text-foreground/80">Current Availability</Label>
              <Select onValueChange={(val) => setValue("available", val === "true")} defaultValue="true">
                <SelectTrigger className="h-12 rounded-xl bg-background/50 focus-visible:ring-primary/30 font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl shadow-lg">
                  <SelectItem value="true" className="font-medium text-emerald-600 focus:text-emerald-700">Available for Appointments</SelectItem>
                  <SelectItem value="false" className="font-medium text-muted-foreground">Unavailable / On Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-border/40 mt-6">
              <Button type="submit" disabled={loading} className="w-full sm:w-auto h-12 gradient-primary border-0 rounded-xl font-bold shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 px-8">
                {loading ? <Loader2 className="mr-2 size-5 animate-spin" /> : <Save className="mr-2 size-5" />}
                Save Changes
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