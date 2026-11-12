"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createBill } from "@/actions/billing";
import { getAllPatients } from "@/actions/patients";
import { getAppointments } from "@/actions/appointments";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormSelect } from "@/components/shared/form-select";
import { toast } from "sonner";
import { format } from "date-fns";
import { Loader2, IndianRupee, Calculator, Receipt } from "lucide-react";

const schema = z.object({
  patientId: z.string().min(1, "Patient is required"),
  appointmentId: z.string().min(1, "Appointment is required"),
  consultationFee: z.coerce.number().min(0, "Fee must be 0 or more"),
  additionalCharges: z.coerce.number().min(0).default(0),
  discount: z.coerce.number().min(0).default(0),
  paymentMethod: z.string().optional().or(z.literal("")),
});

export default function NewBillPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { patientId: "", appointmentId: "", consultationFee: 0, additionalCharges: 0, discount: 0, paymentMethod: "" },
  });

  const selectedPatientId = watch("patientId");
  const selectedAppointmentId = watch("appointmentId");
  const consultationFee = watch("consultationFee") || 0;
  const additionalCharges = watch("additionalCharges") || 0;
  const discount = watch("discount") || 0;
  const total = parseFloat(consultationFee) + parseFloat(additionalCharges) - parseFloat(discount);

  useEffect(() => {
    Promise.all([getAllPatients(), getAppointments({ limit: 200 })]).then(([p, a]) => {
      if (p.success) setPatients(p.data || []);
      if (a.success) setAppointments(a.data || []);
    });
  }, []);

  // Filter appointments for the selected patient
  const filteredAppointments = selectedPatientId
    ? appointments.filter((a) => a.patientId === selectedPatientId)
    : appointments;

  const handlePatientSelect = (val) => {
    setValue("patientId", val);
    if (selectedAppointmentId) {
      const currentApt = appointments.find((a) => a.id === selectedAppointmentId);
      if (currentApt && currentApt.patientId !== val) {
        setValue("appointmentId", "");
      }
    }
  };

  const handleAppointmentSelect = (val) => {
    setValue("appointmentId", val);
    const selectedApt = appointments.find((a) => a.id === val);
    if (selectedApt) {
      if (selectedApt.patientId && selectedApt.patientId !== selectedPatientId) {
        setValue("patientId", selectedApt.patientId);
      }
      const defaultFee = selectedApt.doctor?.consultationFee || 500;
      if (!consultationFee || consultationFee === 0) {
        setValue("consultationFee", defaultFee);
      }
    }
  };

  const onSubmit = async (data) => {
    setLoading(true);
    const result = await createBill(data);
    if (result.success) {
      toast.success(result.message);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("refresh-notifications"));
      }
      router.push("/billing");
    }
    else { toast.error(result.message); }
    setLoading(false);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto space-y-6">
      <PageHeader 
        title="Generate Invoice" 
        description="Create a detailed billing invoice for a consultation" 
        breadcrumbs={[{ label: "Billing", href: "/billing" }, { label: "Generate" }]} 
      />
      
      <Card className="shadow-soft border-border/40 bg-card rounded-3xl overflow-hidden">
        <CardHeader className="bg-muted/20 border-b border-border/30 pb-4">
          <CardTitle className="text-lg font-bold flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl text-primary"><IndianRupee className="size-5" /></div>
            Invoice Details
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 sm:p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2.5">
                <Label className="font-semibold">Patient <span className="text-destructive">*</span></Label>
                <FormSelect 
                  value={selectedPatientId}
                  options={patients.map(p => ({ value: p.id, label: `${p.firstName} ${p.lastName}` }))} 
                  onValueChange={handlePatientSelect} 
                  placeholder="Select patient" 
                />
                {errors.patientId && <p className="text-sm font-medium text-destructive animate-in slide-in-from-top-1">{errors.patientId.message}</p>}
              </div>
              <div className="space-y-2.5">
                <Label className="font-semibold">Appointment <span className="text-destructive">*</span></Label>
                <FormSelect 
                  value={selectedAppointmentId}
                  options={filteredAppointments.map((a) => {
                    const patientName = `${a.patient?.firstName || ""} ${a.patient?.lastName || ""}`.trim();
                    const doctorName = `Dr. ${a.doctor?.user?.firstName || ""} ${a.doctor?.user?.lastName || ""}`.trim();
                    const dateStr = a.appointmentDate ? format(new Date(a.appointmentDate), "MMM d, yyyy") : "";
                    const timeStr = a.appointmentTime ? ` at ${a.appointmentTime}` : "";
                    return {
                      value: a.id,
                      label: `${patientName} — ${doctorName} (${dateStr}${timeStr})`,
                    };
                  })} 
                  onValueChange={handleAppointmentSelect} 
                  placeholder={selectedPatientId ? "Select patient's appointment" : "Select related appointment"} 
                />
                {errors.appointmentId && <p className="text-sm font-medium text-destructive animate-in slide-in-from-top-1">{errors.appointmentId.message}</p>}
              </div>
            </div>

            <div className="rounded-2xl border border-border/50 p-6 bg-background space-y-6">
              <div className="flex items-center gap-2 mb-2 text-muted-foreground font-bold uppercase tracking-wider text-sm">
                <Calculator className="size-4" /> Billing Breakdown
              </div>
              
              <div className="grid gap-6 sm:grid-cols-3">
                <div className="space-y-2.5">
                  <Label htmlFor="consultationFee" className="font-semibold">Consultation Fee (₹) <span className="text-destructive">*</span></Label>
                  <Input id="consultationFee" type="number" min="0" step="0.01" className="h-11 rounded-xl bg-muted/30 focus-visible:ring-primary/30 text-lg font-medium" {...register("consultationFee")} />
                  {errors.consultationFee && <p className="text-sm font-medium text-destructive">{errors.consultationFee.message}</p>}
                </div>
                <div className="space-y-2.5">
                  <Label htmlFor="additionalCharges" className="font-semibold">Additional Charges (₹)</Label>
                  <Input id="additionalCharges" type="number" min="0" step="0.01" className="h-11 rounded-xl bg-muted/30 focus-visible:ring-primary/30 text-lg font-medium" {...register("additionalCharges")} />
                </div>
                <div className="space-y-2.5">
                  <Label htmlFor="discount" className="font-semibold">Discount (₹)</Label>
                  <Input id="discount" type="number" min="0" step="0.01" className="h-11 rounded-xl bg-muted/30 focus-visible:ring-primary/30 text-lg font-medium" {...register("discount")} />
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              <Label className="font-semibold">Initial Payment Method</Label>
              <div className="w-full sm:max-w-xs">
                <FormSelect
                  options={[{ value: "CASH", label: "Cash" }, { value: "CARD", label: "Credit/Debit Card" }, { value: "UPI", label: "UPI / Digital" }]}
                  onValueChange={(val) => setValue("paymentMethod", val)}
                  placeholder="Select method (optional)"
                />
              </div>
              <p className="text-sm text-muted-foreground">Leaving this empty will mark the bill as pending.</p>
            </div>

            {/* Total Calculation Display */}
            <div className="rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 flex flex-col sm:flex-row items-center justify-between border border-primary/20 shadow-inner">
              <div className="text-center sm:text-left mb-2 sm:mb-0">
                <span className="block text-sm font-bold uppercase tracking-wider text-primary">Final Calculation</span>
                <span className="text-muted-foreground font-medium text-sm">Total amount due for this invoice</span>
              </div>
              <span className="text-4xl font-black text-foreground flex items-center gap-1">
                <IndianRupee className="size-8 text-primary" />
                {Math.max(0, total).toFixed(2)}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border/40">
              <Button type="submit" disabled={loading} className="w-full sm:w-auto h-12 gradient-primary border-0 rounded-xl font-bold shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 px-8 text-base">
                {loading && <Loader2 className="mr-2 size-5 animate-spin" />} Generate Invoice
              </Button>
              <Button type="button" variant="outline" className="w-full sm:w-auto h-12 rounded-xl font-bold" onClick={() => router.push("/billing")}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}