"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { getMedicalRecordById, updateMedicalRecord } from "@/actions/medical-records";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, FileText, Save, ArrowLeft } from "lucide-react";
import { PageLoader } from "@/components/shared/page-loader";
import { format } from "date-fns";

const schema = z.object({
  diagnosis: z.string().min(2, "Diagnosis is required"),
  symptoms: z.string().min(2, "Symptoms are required"),
  treatment: z.string().min(2, "Treatment is required"),
  allergies: z.string().optional().or(z.literal("")),
  doctorNotes: z.string().optional().or(z.literal("")),
  followUpDate: z.string().optional().or(z.literal("")),
});

export default function EditMedicalRecordPage() {
  const router = useRouter();
  const params = useParams();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    getMedicalRecordById(params.id).then((result) => {
      if (result.success) {
        const r = result.data;
        reset({
          diagnosis: r.diagnosis || "",
          symptoms: r.symptoms || "",
          treatment: r.treatment || "",
          allergies: r.allergies || "",
          doctorNotes: r.doctorNotes || "",
          followUpDate: r.followUpDate ? format(new Date(r.followUpDate), "yyyy-MM-dd") : "",
        });
      } else { toast.error(result.message); router.push("/medical-records"); }
      setFetching(false);
    });
  }, [params.id, reset, router]);

  const onSubmit = async (data) => {
    setLoading(true);
    const result = await updateMedicalRecord(params.id, data);
    if (result.success) { toast.success(result.message); router.push(`/medical-records/${params.id}`); }
    else { toast.error(result.message); }
    setLoading(false);
  };

  if (fetching) {
    return (
      <PageLoader
        messages={[
          "Loading clinical data…",
          "Fetching the record to edit…",
          "Be patient, preparing the form…",
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
          title="Edit Medical Record" 
          description="Update clinical information, diagnosis, and treatment plan" 
          breadcrumbs={[{ label: "Medical Records", href: "/medical-records" }, { label: "Edit" }]} 
          className="m-0 p-0"
        />
      </div>

      <Card className="shadow-soft border-border/40 bg-card rounded-3xl overflow-hidden">
        <CardHeader className="bg-primary/5 border-b border-primary/10 pb-4">
          <CardTitle className="text-lg font-bold flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl text-primary"><FileText className="size-5" /></div>
            Clinical Information
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 sm:p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2.5">
                <Label htmlFor="symptoms" className="font-semibold text-foreground/80">Symptoms <span className="text-destructive">*</span></Label>
                <Textarea id="symptoms" rows={3} {...register("symptoms")} className="rounded-xl bg-background/50 focus-visible:ring-primary/30 resize-none text-base" />
                {errors.symptoms && <p className="text-sm font-medium text-destructive animate-in slide-in-from-top-1">{errors.symptoms.message}</p>}
              </div>
              <div className="space-y-2.5">
                <Label htmlFor="diagnosis" className="font-semibold text-foreground/80">Diagnosis <span className="text-destructive">*</span></Label>
                <Textarea id="diagnosis" rows={3} {...register("diagnosis")} className="rounded-xl bg-background/50 focus-visible:ring-primary/30 resize-none text-base" />
                {errors.diagnosis && <p className="text-sm font-medium text-destructive animate-in slide-in-from-top-1">{errors.diagnosis.message}</p>}
              </div>
            </div>
            
            <div className="space-y-2.5">
              <Label htmlFor="treatment" className="font-semibold text-foreground/80">Treatment Plan <span className="text-destructive">*</span></Label>
              <Textarea id="treatment" rows={3} {...register("treatment")} className="rounded-xl bg-background/50 focus-visible:ring-primary/30 resize-none text-base" />
              {errors.treatment && <p className="text-sm font-medium text-destructive animate-in slide-in-from-top-1">{errors.treatment.message}</p>}
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2.5">
                <Label htmlFor="allergies" className="font-semibold text-foreground/80">Allergies</Label>
                <Input id="allergies" {...register("allergies")} className="h-12 rounded-xl bg-background/50 focus-visible:ring-primary/30" />
              </div>
              <div className="space-y-2.5">
                <Label htmlFor="followUpDate" className="font-semibold text-foreground/80">Follow-up Date</Label>
                <Input id="followUpDate" type="date" {...register("followUpDate")} className="h-12 rounded-xl bg-background/50 focus-visible:ring-primary/30" />
              </div>
            </div>

            <div className="space-y-2.5">
              <Label htmlFor="doctorNotes" className="font-semibold text-foreground/80">Confidential Doctor Notes</Label>
              <Textarea id="doctorNotes" rows={3} {...register("doctorNotes")} className="rounded-xl bg-background/50 focus-visible:ring-primary/30 resize-none text-base" placeholder="Internal notes not explicitly shown to patients..." />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-border/40 mt-6">
              <Button type="submit" disabled={loading} className="w-full sm:w-auto h-12 gradient-primary border-0 rounded-xl font-bold shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 px-8 text-base">
                {loading ? <Loader2 className="mr-2 size-5 animate-spin" /> : <Save className="mr-2 size-5" />}
                Save Updates
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push(`/medical-records/${params.id}`)} className="w-full sm:w-auto h-12 rounded-xl font-bold">
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}