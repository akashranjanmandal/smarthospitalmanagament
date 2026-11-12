"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { getAppointmentById, cancelAppointment, completeAppointment } from "@/actions/appointments";
import { useRole } from "@/hooks/use-role";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { XCircle, CheckCircle, UserCog, Users, Calendar, FileText, ArrowLeft } from "lucide-react";
import { PageLoader } from "@/components/shared/page-loader";

export default function AppointmentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { isPatient } = useRole();
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchAppointment = async () => {
    const result = await getAppointmentById(params.id);
    if (result.success) {
      setAppointment(result.data);
    } else {
      toast.error(result.message);
      router.push("/appointments");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAppointment();
  }, [params.id]);

  const handleCancel = async () => {
    setActionLoading(true);
    const result = await cancelAppointment(params.id);
    if (result.success) {
      toast.success(result.message);
      fetchAppointment();
    } else {
      toast.error(result.message);
    }
    setActionLoading(false);
  };

  const handleComplete = async () => {
    setActionLoading(true);
    const result = await completeAppointment(params.id);
    if (result.success) {
      toast.success(result.message);
      fetchAppointment();
    } else {
      toast.error(result.message);
    }
    setActionLoading(false);
  };

  if (loading) {
    return (
      <PageLoader
        messages={[
          "Fetching appointment details…",
          "Loading schedule data…",
          "Checking availability…",
          "Almost ready…",
        ]}
      />
    );
  }

  if (!appointment) return null;

  const statusColors = {
    SCHEDULED: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 border-0",
    COMPLETED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-0",
    CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 border-0"
  };

  return (
    <div className="animate-in fade-in zoom-in-95 duration-500 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Appointment Details"
        description={`ID: #${appointment.id.slice(0, 8)}`}
        breadcrumbs={[
          { label: "Appointments", href: "/appointments" },
          { label: "Details" },
        ]}
        onBack={() => router.back()}
      >
        {appointment.status === "SCHEDULED" && (
          <div className="grid grid-cols-2 sm:flex gap-2.5 sm:gap-3 w-full sm:w-auto">
            {!isPatient && (
              <Button onClick={handleComplete} disabled={actionLoading} className="w-full sm:w-auto gradient-accent border-0 rounded-xl shadow-md hover:shadow-lg transition-all font-bold h-11">
                <CheckCircle className="mr-2 size-4" /> Mark Complete
              </Button>
            )}
            <Button variant="destructive" onClick={handleCancel} disabled={actionLoading} className="w-full sm:w-auto rounded-xl shadow-md hover:shadow-lg transition-all font-bold h-11">
              <XCircle className="mr-2 size-4" /> Cancel
            </Button>
          </div>
        )}
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-5 items-start">
        {/* Left Column - Main Info */}
        <Card className="lg:col-span-3 shadow-soft border-border/40 bg-card rounded-3xl overflow-hidden">
          <CardHeader className="bg-muted/20 border-b border-border/30 pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl text-primary"><Calendar className="size-5" /></div>
              Appointment Info
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-6 bg-background rounded-2xl border border-border/50 p-5">
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Status</p>
                <Badge className={`px-3 py-1 font-bold ${statusColors[appointment.status] || "secondary"}`}>
                  {appointment.status}
                </Badge>
              </div>
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Schedule</p>
                <p className="font-bold text-foreground">{format(new Date(appointment.appointmentDate), "MMM dd, yyyy")}</p>
                <p className="text-sm font-semibold text-primary">{appointment.appointmentTime}</p>
              </div>
            </div>

            {appointment.reason && (
              <div className="space-y-2">
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <FileText className="size-4" /> Reason for visit
                </p>
                <div className="bg-muted/30 p-4 rounded-xl border border-border/40 text-foreground font-medium leading-relaxed">
                  {appointment.reason}
                </div>
              </div>
            )}
            
            {appointment.notes && (
              <div className="space-y-2">
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <FileText className="size-4" /> Additional Notes
                </p>
                <div className="bg-muted/30 p-4 rounded-xl border border-border/40 text-foreground font-medium leading-relaxed">
                  {appointment.notes}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column - People & Meta */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-soft border-border/40 bg-card rounded-3xl overflow-hidden">
            <CardHeader className="bg-blue-50/50 dark:bg-blue-900/10 border-b border-border/30 pb-4">
              <CardTitle className="text-lg font-bold flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400 rounded-xl"><UserCog className="size-5" /></div>
                Consulting Doctor
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <p className="text-lg font-extrabold text-foreground">Dr. {appointment.doctor.user.firstName} {appointment.doctor.user.lastName}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="secondary" className="font-semibold">{appointment.doctor.department.name}</Badge>
                <Badge variant="outline" className="font-semibold text-muted-foreground">{appointment.doctor.specialization}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft border-border/40 bg-card rounded-3xl overflow-hidden">
            <CardHeader className="bg-teal-50/50 dark:bg-teal-900/10 border-b border-border/30 pb-4">
              <CardTitle className="text-lg font-bold flex items-center gap-3">
                <div className="p-2 bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-400 rounded-xl"><Users className="size-5" /></div>
                Patient Info
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <p className="text-lg font-extrabold text-foreground">{appointment.patient.firstName} {appointment.patient.lastName}</p>
              <p className="text-sm font-semibold text-muted-foreground mt-1 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-teal-500" />
                {appointment.patient.phone || "No phone provided"}
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-soft border-border/40 bg-card rounded-3xl overflow-hidden">
            <CardContent className="p-0">
              <div className="divide-y divide-border/40">
                <div className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-muted rounded-lg"><FileText className="size-4 text-muted-foreground" /></div>
                    <span className="font-bold text-sm">Medical Record</span>
                  </div>
                  <Badge className={`font-bold ${appointment.medicalRecord ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>
                    {appointment.medicalRecord ? "Generated" : "Not yet"}
                  </Badge>
                </div>
                <div className="p-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-muted rounded-lg"><FileText className="size-4 text-muted-foreground" /></div>
                    <span className="font-bold text-sm">Billing</span>
                  </div>
                  <Badge className={`font-bold ${appointment.bill ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>
                    {appointment.bill ? `₹${appointment.bill.totalAmount}` : "Not generated"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}