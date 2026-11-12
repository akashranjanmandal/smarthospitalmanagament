"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createMedicalRecord } from "@/actions/medical-records";
import { getAllDoctors } from "@/actions/doctors";
import { getAllPatients } from "@/actions/patients";
import { getAppointments } from "@/actions/appointments";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormSelect } from "@/components/shared/form-select";
import { toast } from "sonner";
import { Loader2, FileText, UserRound, ClipboardList } from "lucide-react";
import { format } from "date-fns";

const schema = z.object({
  appointmentId: z.string().min(1, "Appointment is required"),
  patientId: z.string().min(1, "Patient is required"),
  doctorId: z.string().min(1, "Doctor is required"),
  diagnosis: z.string().min(2, "Diagnosis is required"),
  symptoms: z.string().min(2, "Symptoms are required"),
  treatment: z.string().min(2, "Treatment is required"),
  allergies: z.string().optional().or(z.literal("")),
  doctorNotes: z.string().optional().or(z.literal("")),
  followUpDate: z.string().optional().or(z.literal("")),
});

export default function NewMedicalRecordPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { appointmentId: "", patientId: "", doctorId: "", diagnosis: "", symptoms: "", treatment: "", allergies: "", doctorNotes: "", followUpDate: "" },
  });

  useEffect(() => {
    Promise.all([getAllDoctors(), getAllPatients(), getAppointments({ status: "COMPLETED", limit: 100 })]).then(([d, p, a]) => {
      if (d.success) setDoctors(d.data);
      if (p.success) setPatients(p.data);
      if (a.success) setAppointments(a.data);
    });
  }, []);

  const onSubmit = async (data) => {
    setLoading(true);
    const result = await createMedicalRecord(data);
    if (result.success) { toast.success(result.message); router.push("/medical-records"); }
    else { toast.error(result.message); }
    setLoading(false);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto space-y-6">
      <PageHeader 
        title="Create Medical Record" 
        description="Document clinical findings and consultation details" 
        breadcrumbs={[{ label: "Medical Records", href: "/medical-records" }, { label: "Create" }]} 
      />
      
      <Card className="shadow-soft border-border/40 bg-card rounded-3xl overflow-hidden">
        <CardHeader className="bg-primary/5 border-b border-primary/10 pb-4">
          <CardTitle className="text-lg font-bold flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl text-primary"><FileText className="size-5" /></div>
            Record Details
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 sm:p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            
            {/* Context Section */}
            <div className="space-y-6 rounded-2xl border border-border/50 bg-background p-6">
              <div className="flex items-center gap-2 mb-2 text-muted-foreground font-bold uppercase tracking-wider text-sm">
                <UserRound className="size-4" /> Encounter Context
              </div>
              
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2.5">
                  <Label className="font-semibold text-foreground/80">Patient <span className="text-destructive">*</span></Label>
                  <FormSelect 
                    options={patients.map(p => ({ value: p.id, label: `${p.firstName} ${p.lastName}` }))} 
                    onValueChange={(val) => setValue("patientId", val)} 
                    placeholder="Search patient..." 
                  />
                  {errors.patientId && <p className="text-sm font-medium text-destructive animate-in slide-in-from-top-1">{errors.patientId.message}</p>}
                </div>
                <div className="space-y-2.5">
                  <Label className="font-semibold text-foreground/80">Consulting Doctor <span className="text-destructive">*</span></Label>
                  <FormSelect 
                    options={doctors.map(d => ({ value: d.id, label: `Dr. ${d.user.firstName} ${d.user.lastName}` }))} 
                    onValueChange={(val) => setValue("doctorId", val)} 
                    placeholder="Search doctor..." 
                  />
                  {errors.doctorId && <p className="text-sm font-medium text-destructive animate-in slide-in-from-top-1">{errors.doctorId.message}</p>}
                </div>
              </div>

              <div className="space-y-2.5">
                <Label className="font-semibold text-foreground/80">Linked Appointment <span className="text-destructive">*</span></Label>
                <FormSelect 
                  options={appointments.map(a => ({ value: a.id, label: `${a.patient.firstName} ${a.patient.lastName} - Dr. ${a.doctor.user.firstName} (${format(new Date(a.appointmentDate), "MMM dd")})` }))} 
                  onValueChange={(val) => setValue("appointmentId", val)} 
                  placeholder="Select completed appointment..." 
                />
                {errors.appointmentId && <p className="text-sm font-medium text-destructive animate-in slide-in-from-top-1">{errors.appointmentId.message}</p>}
              </div>
            </div>

            {/* Clinical Section */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-2 text-muted-foreground font-bold uppercase tracking-wider text-sm border-b border-border/50 pb-2">
                <ClipboardList className="size-4" /> Clinical Data
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2.5">
                  <Label htmlFor="symptoms" className="font-semibold text-foreground/80">Presenting Symptoms <span className="text-destructive">*</span></Label>
                  <Textarea id="symptoms" rows={3} placeholder="Describe patient symptoms..." {...register("symptoms")} className="rounded-xl bg-background/50 focus-visible:ring-primary/30 resize-none text-base" />
                  {errors.symptoms && <p className="text-sm font-medium text-destructive animate-in slide-in-from-top-1">{errors.symptoms.message}</p>}
                </div>
                <div className="space-y-2.5">
                  <Label htmlFor="diagnosis" className="font-semibold text-foreground/80">Diagnosis <span className="text-destructive">*</span></Label>
                  <Textarea id="diagnosis" rows={3} placeholder="Final medical diagnosis..." {...register("diagnosis")} className="rounded-xl bg-background/50 focus-visible:ring-primary/30 resize-none text-base" />
                  {errors.diagnosis && <p className="text-sm font-medium text-destructive animate-in slide-in-from-top-1">{errors.diagnosis.message}</p>}
                </div>
              </div>

              <div className="space-y-2.5">
                <Label htmlFor="treatment" className="font-semibold text-foreground/80">Treatment Plan <span className="text-destructive">*</span></Label>
                <Textarea id="treatment" rows={3} placeholder="Outline the proposed treatment plan..." {...register("treatment")} className="rounded-xl bg-background/50 focus-visible:ring-primary/30 resize-none text-base" />
                {errors.treatment && <p className="text-sm font-medium text-destructive animate-in slide-in-from-top-1">{errors.treatment.message}</p>}
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2.5">
                  <Label htmlFor="allergies" className="font-semibold text-foreground/80 text-red-600 dark:text-red-400">Known Allergies</Label>
                  <Input id="allergies" placeholder="e.g. Penicillin, Peanuts (Leave blank if none)" {...register("allergies")} className="h-12 rounded-xl bg-red-50/30 dark:bg-red-900/10 border-red-200 dark:border-red-900 focus-visible:ring-red-500/30" />
                </div>
                <div className="space-y-2.5">
                  <Label htmlFor="followUpDate" className="font-semibold text-foreground/80">Follow-up Date</Label>
                  <Input id="followUpDate" type="date" {...register("followUpDate")} className="h-12 rounded-xl bg-background/50 focus-visible:ring-primary/30" />
                </div>
              </div>

              <div className="space-y-2.5">
                <Label htmlFor="doctorNotes" className="font-semibold text-foreground/80">Confidential Doctor Notes</Label>
                <Textarea id="doctorNotes" rows={3} placeholder="Internal/private notes (optional)" {...register("doctorNotes")} className="rounded-xl bg-background/50 focus-visible:ring-primary/30 resize-none text-base italic" />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-border/40 mt-6">
              <Button type="submit" disabled={loading} className="w-full sm:w-auto h-12 gradient-primary border-0 rounded-xl font-bold shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 px-8 text-base">
                {loading ? <Loader2 className="mr-2 size-5 animate-spin" /> : <FileText className="mr-2 size-5" />}
                Create Medical Record
              </Button>
              <Button type="button" variant="outline" className="w-full sm:w-auto h-12 rounded-xl font-bold" onClick={() => router.push("/medical-records")}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}