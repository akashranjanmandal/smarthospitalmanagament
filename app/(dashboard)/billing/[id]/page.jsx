"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { getBillById, markBillPaid } from "@/actions/billing";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FormSelect } from "@/components/shared/form-select";
import { toast } from "sonner";
import { format } from "date-fns";
import { Loader2, Printer, CheckCircle, Receipt, Building2, User, Stethoscope, ArrowLeft, IndianRupee, Activity } from "lucide-react";
import { PageLoader } from "@/components/shared/page-loader";

export default function BillDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payMethod, setPayMethod] = useState("CASH");

  useEffect(() => {
    getBillById(params.id).then((result) => {
      if (result.success) setBill(result.data);
      else { toast.error(result.message); router.push("/billing"); }
      setLoading(false);
    });
  }, [params.id]);

  const handleMarkPaid = async () => {
    const result = await markBillPaid(params.id, payMethod);
    if (result.success) {
      toast.success(result.message);
      setBill({ ...bill, paymentStatus: "PAID", paymentMethod: payMethod });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("refresh-notifications"));
      }
    } else { toast.error(result.message); }
  };

  if (loading) {
    return (
      <PageLoader
        messages={[
          "Loading invoice details…",
          "Calculating charges…",
          "Fetching billing records…",
          "Verifying payment status…",
        ]}
      />
    );
  }
  
  if (!bill) return null;

  return (
    <div className="animate-in fade-in zoom-in-95 duration-500 max-w-4xl mx-auto space-y-6">
      <div className="print:hidden">
        <PageHeader
          title="Invoice Details"
          description={`INV-${bill.id.slice(0, 8).toUpperCase()}`}
          breadcrumbs={[{ label: "Billing", href: "/billing" }, { label: "Invoice" }]}
          onBack={() => router.back()}
        >
          <Button onClick={() => window.print()} className="w-full sm:w-auto rounded-xl shadow-md bg-white text-foreground border border-border/50 hover:bg-muted font-bold transition-all hover:-translate-y-0.5 h-11">
            <Printer className="mr-2 size-4" /> Print Invoice
          </Button>
        </PageHeader>
      </div>

      <Card className="shadow-soft border-border/40 bg-card rounded-3xl overflow-hidden print:shadow-none print:border-0 print:rounded-none">
        {/* Invoice Header (Medical aesthetic) */}
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-8 border-b border-primary/10 print:bg-slate-50 print:[print-color-adjust:exact]">
          <div className="flex flex-col md:flex-row justify-between items-start gap-6">
            <div className="flex items-center gap-4">
              <div className="gradient-primary p-3 rounded-2xl shadow-lg shadow-primary/20 flex items-center justify-center text-white print:bg-sky-700 print:text-white print:[print-color-adjust:exact]">
                <Activity className="size-8 text-white print:text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight">Hospital Invoice</h2>
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-2 mt-1">
                  <Building2 className="size-4" /> Smart Hospital Systems
                </p>
              </div>
            </div>
            
            <div className="text-left md:text-right">
              <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-1">Invoice Status</p>
              <Badge className={`px-4 py-1.5 text-sm font-extrabold shadow-sm ${
                bill.paymentStatus === "PAID" 
                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0" 
                  : "bg-amber-100 text-amber-700 hover:bg-amber-100 border-0"
              }`}>
                {bill.paymentStatus}
              </Badge>
              <p className="text-sm font-semibold text-muted-foreground mt-2">
                Date: <span className="text-foreground">{format(new Date(bill.createdAt), "MMM dd, yyyy")}</span>
              </p>
            </div>
          </div>
        </div>

        <CardContent className="p-8 space-y-8">
          {/* People Meta Data */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-border/50 bg-muted/20 p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <User className="size-4" /> Billed To (Patient)
              </p>
              <p className="text-lg font-extrabold text-foreground">{bill.patient.firstName} {bill.patient.lastName}</p>
              {bill.patient.phone && <p className="text-sm font-medium text-muted-foreground mt-1">{bill.patient.phone}</p>}
            </div>
            <div className="rounded-2xl border border-border/50 bg-muted/20 p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <Stethoscope className="size-4" /> Consulting Doctor
              </p>
              <p className="text-lg font-extrabold text-foreground">Dr. {bill.appointment?.doctor?.user?.firstName} {bill.appointment?.doctor?.user?.lastName}</p>
              <p className="text-sm font-medium text-primary mt-1">{bill.appointment?.doctor?.department?.name}</p>
            </div>
          </div>

          {/* Billing Line Items */}
          <div className="rounded-2xl border border-border/50 overflow-hidden">
            <div className="bg-muted/40 px-6 py-3 border-b border-border/50 flex justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Description</span>
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Amount</span>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-foreground">Consultation Fee</span>
                <span className="font-bold text-foreground">₹{bill.consultationFee.toFixed(2)}</span>
              </div>
              {bill.additionalCharges > 0 && (
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-foreground">Additional Charges</span>
                  <span className="font-bold text-foreground">₹{bill.additionalCharges.toFixed(2)}</span>
                </div>
              )}
              {bill.discount > 0 && (
                <div className="flex justify-between items-center text-emerald-600">
                  <span className="font-semibold">Discount Applied</span>
                  <span className="font-bold">-₹{bill.discount.toFixed(2)}</span>
                </div>
              )}
            </div>
            <div className="bg-primary/5 px-6 py-5 border-t border-primary/10 flex justify-between items-center">
              <span className="text-xl font-extrabold text-foreground">Total Amount</span>
              <span className="text-3xl font-black text-primary">₹{bill.totalAmount.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment Actions */}
          <div className="print:hidden">
            {bill.paymentStatus === "PAID" && (
              <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 p-5 flex items-center justify-between animate-in slide-in-from-bottom-4">
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-100 dark:bg-emerald-800 p-2 rounded-full">
                    <CheckCircle className="size-5 text-emerald-600 dark:text-emerald-300" />
                  </div>
                  <div>
                    <span className="block font-bold text-emerald-700 dark:text-emerald-400">Payment Completed</span>
                    <span className="text-sm font-medium text-emerald-600/80 dark:text-emerald-400/80">Thank you for your payment.</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="block text-xs font-bold uppercase tracking-wider text-emerald-600/70 dark:text-emerald-400/70">Method</span>
                  <span className="font-extrabold text-emerald-700 dark:text-emerald-400">{bill.paymentMethod}</span>
                </div>
              </div>
            )}

            {bill.paymentStatus === "PENDING" && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-900 p-6 animate-in slide-in-from-bottom-4">
                <p className="font-bold text-amber-800 dark:text-amber-500 mb-4">Complete Payment</p>
                <div className="flex flex-col sm:flex-row items-end gap-4">
                  <div className="w-full sm:flex-1 space-y-2">
                    <FormSelect
                      options={[{ value: "CASH", label: "Cash" }, { value: "CARD", label: "Credit/Debit Card" }, { value: "UPI", label: "UPI / Digital" }]}
                      onValueChange={setPayMethod}
                      placeholder="Select payment method"
                    />
                  </div>
                  <Button onClick={handleMarkPaid} className="w-full sm:w-auto h-11 gradient-accent border-0 rounded-xl font-bold shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 px-6">
                    <CheckCircle className="mr-2 size-5" /> Mark as Paid
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}