"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createPrescription } from "@/actions/prescriptions";
import { getFormulary } from "@/actions/pharmacy";
import { getMedicalRecords } from "@/actions/medical-records";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormSelect } from "@/components/shared/form-select";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Pill, FileText, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

const itemSchema = z.object({
  medicineName: z.string().min(1, "Medicine name is required"),
  dosage: z.string().min(1, "Dosage is required"),
  frequency: z.string().min(1, "Frequency is required"),
  duration: z.string().min(1, "Duration is required"),
  instructions: z.string().optional().or(z.literal("")),
});

const schema = z.object({
  medicalRecordId: z.string().min(1, "Medical record is required"),
  instructions: z.string().optional().or(z.literal("")),
  items: z.array(itemSchema).min(1, "At least one medicine is required"),
});

export default function NewPrescriptionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preSelectedRecordId = searchParams.get("medicalRecordId");

  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [formulary, setFormulary] = useState([]);
  const [warnings, setWarnings] = useState(null);

  const { register, handleSubmit, setValue, control, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      medicalRecordId: preSelectedRecordId || "",
      instructions: "",
      items: [{ medicineName: "", dosage: "", frequency: "", duration: "", instructions: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  useEffect(() => {
    getMedicalRecords({ limit: 100 }).then((res) => {
      if (res.success) setRecords(res.data);
    });
    getFormulary({ activeOnly: true }).then((res) => {
      if (res.success) setFormulary(res.data);
    });
    if (preSelectedRecordId) setValue("medicalRecordId", preSelectedRecordId);
  }, [preSelectedRecordId, setValue]);

  const send = async (data) => {
    setLoading(true);
    const result = await createPrescription(data);
    setLoading(false);
    if (result.needsConfirmation) return setWarnings({ list: result.warnings, data });
    if (result.success) { toast.success(result.message); router.push("/prescriptions"); }
    else { toast.error(result.message); }
  };
  const onSubmit = (data) => { setWarnings(null); send(data); };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto space-y-6">
      <PageHeader 
        title="Create Prescription" 
        description="Prescribe medications and formulate instructions for a patient visit" 
        breadcrumbs={[{ label: "Prescriptions", href: "/prescriptions" }, { label: "Create" }]} 
      />
      
      <Card className="shadow-soft border-border/40 bg-card rounded-3xl overflow-hidden">
        <CardHeader className="bg-primary/5 border-b border-primary/10 pb-4">
          <CardTitle className="text-lg font-bold flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl text-primary"><Pill className="size-5" /></div>
            Prescription Details
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 sm:p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            
            {/* Context Section */}
            <div className="space-y-6 rounded-2xl border border-border/50 bg-background p-6">
              <div className="flex items-center gap-2 mb-2 text-muted-foreground font-bold uppercase tracking-wider text-sm border-b border-border/50 pb-2">
                <FileText className="size-4" /> Clinical Link
              </div>
              
              <div className="space-y-2.5">
                <Label className="font-semibold text-foreground/80">Linked Medical Record <span className="text-destructive">*</span></Label>
                <FormSelect
                  options={records.map(r => ({ 
                    value: r.id, 
                    label: `${r.patient.firstName} ${r.patient.lastName} - ${r.diagnosis || "No diagnosis"} (${format(new Date(r.createdAt), "MMM dd, yyyy")})` 
                  }))}
                  onValueChange={(val) => setValue("medicalRecordId", val)}
                  placeholder="Select the corresponding medical record"
                />
                {errors.medicalRecordId && <p className="text-sm font-medium text-destructive animate-in slide-in-from-top-1">{errors.medicalRecordId.message}</p>}
              </div>

              <div className="space-y-2.5">
                <Label htmlFor="instructions" className="font-semibold text-foreground/80">General Advice / Instructions</Label>
                <Textarea 
                  id="instructions" 
                  rows={3} 
                  placeholder="General lifestyle advice or overarching prescription instructions..." 
                  {...register("instructions")} 
                  className="rounded-xl bg-background/50 focus-visible:ring-primary/30 resize-none text-base"
                />
              </div>
            </div>

            {/* Dynamic Medicines Array */}
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-2">
                <Label className="font-bold text-lg text-foreground flex items-center gap-2">
                  <Pill className="size-5 text-primary" /> Medications List <span className="text-destructive">*</span>
                </Label>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  className="rounded-xl h-10 font-bold hover:bg-primary/5 hover:text-primary transition-colors border-primary/20"
                  onClick={() => append({ medicineName: "", dosage: "", frequency: "", duration: "", instructions: "" })}
                >
                  <Plus className="mr-1.5 size-4" /> Add Medication
                </Button>
              </div>

              {errors.items?.root && <p className="text-sm font-medium text-destructive">{errors.items.root.message}</p>}

              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className="relative rounded-2xl border-2 border-border/40 bg-muted/10 p-5 sm:p-6 transition-all hover:border-primary/30 hover:shadow-sm">
                    <div className="absolute -top-3 -left-3 size-8 rounded-xl bg-primary text-white flex items-center justify-center font-bold text-sm shadow-md">
                      {index + 1}
                    </div>
                    
                    {fields.length > 1 && (
                      <Button 
                        type="button" 
                        variant="destructive" 
                        size="icon" 
                        className="absolute -top-3 -right-3 size-8 rounded-xl shadow-md h-8 w-8"
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                    
                    <div className="grid gap-5 sm:grid-cols-2 mt-2">
                      <div className="space-y-2 sm:col-span-2">
                        <Label className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Medicine Name</Label>
                        <Input list="formulary-medicines" autoComplete="off" placeholder="Start typing — pick from the hospital formulary" {...register(`items.${index}.medicineName`)} className="h-12 rounded-xl bg-background font-bold text-base focus-visible:ring-primary/30" />
                        {errors.items?.[index]?.medicineName && <p className="text-xs font-medium text-destructive">{errors.items[index].medicineName.message}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Dosage</Label>
                        <Input placeholder="e.g., 1 tablet, 10ml" {...register(`items.${index}.dosage`)} className="h-11 rounded-xl bg-background focus-visible:ring-primary/30" />
                        {errors.items?.[index]?.dosage && <p className="text-xs font-medium text-destructive">{errors.items[index].dosage.message}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Frequency</Label>
                        <Input placeholder="e.g., 1-0-1, BD, TDS" {...register(`items.${index}.frequency`)} className="h-11 rounded-xl bg-background focus-visible:ring-primary/30" />
                        {errors.items?.[index]?.frequency && <p className="text-xs font-medium text-destructive">{errors.items[index].frequency.message}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Duration</Label>
                        <Input placeholder="e.g., 7 days, 2 weeks" {...register(`items.${index}.duration`)} className="h-11 rounded-xl bg-background focus-visible:ring-primary/30" />
                        {errors.items?.[index]?.duration && <p className="text-xs font-medium text-destructive">{errors.items[index].duration.message}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Specific Instructions</Label>
                        <Input placeholder="e.g., Take after meals" {...register(`items.${index}.instructions`)} className="h-11 rounded-xl bg-background focus-visible:ring-primary/30" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <datalist id="formulary-medicines">
              {formulary.map((m) => <option key={m.id} value={m.name}>{m.genericName}{m.strength ? ` ${m.strength}` : ""} · {m.stockOnHand} in stock</option>)}
            </datalist>

            {warnings && (
              <div role="alert" className="mt-6 space-y-3 rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
                <p className="font-semibold">Check before prescribing</p>
                <ul className="list-disc space-y-1 pl-5">
                  {warnings.list.map((w, i) => <li key={i}><span className="font-semibold">{w.type === "ALLERGY" ? "Allergy" : w.type === "INTERACTION" ? "Interaction" : "Duplicate"}:</span> {w.message}</li>)}
                </ul>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" className="h-9 rounded-lg" onClick={() => setWarnings(null)}>Change the prescription</Button>
                  <Button type="button" className="h-9 rounded-lg bg-rose-700 text-white hover:bg-rose-800" disabled={loading} onClick={() => send({ ...warnings.data, acknowledgeWarnings: true })}>I have checked — prescribe anyway</Button>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-border/40 mt-6">
              <Button type="submit" disabled={loading} className="w-full sm:w-auto h-12 gradient-primary border-0 rounded-xl font-bold shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 px-8 text-base">
                {loading ? <Loader2 className="mr-2 size-5 animate-spin" /> : <CheckCircle2 className="mr-2 size-5" />}
                Generate Prescription
              </Button>
              <Button type="button" variant="outline" className="w-full sm:w-auto h-12 rounded-xl font-bold" onClick={() => router.push("/prescriptions")}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}