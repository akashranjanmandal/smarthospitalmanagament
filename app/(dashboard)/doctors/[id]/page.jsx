"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { getDoctorById } from "@/actions/doctors";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Pencil, Loader2, Phone, Mail, Clock, Award, GraduationCap, ArrowLeft, CalendarDays, FileText, Pill } from "lucide-react";
import { PageLoader } from "@/components/shared/page-loader";
import { toast } from "sonner";
import { format } from "date-fns";

export default function DoctorDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDoctorById(params.id).then((result) => {
      if (result.success) {
        setDoctor(result.data);
      } else {
        toast.error(result.message);
        router.push("/doctors");
      }
      setLoading(false);
    });
  }, [params.id, router]);

  if (loading) {
    return (
      <PageLoader
        messages={[
          "Loading doctor profile…",
          "Fetching clinical history…",
          "Syncing schedule data…",
          "Almost ready…",
        ]}
      />
    );
  }

  if (!doctor) return null;

  const initials = `${doctor.user.firstName?.[0] || ""}${doctor.user.lastName?.[0] || ""}`.toUpperCase();

  return (
    <div className="animate-in fade-in zoom-in-95 duration-500 space-y-6 max-w-6xl mx-auto">
      <PageHeader
        title={`Dr. ${doctor.user.firstName} ${doctor.user.lastName}`}
        description={doctor.specialization}
        breadcrumbs={[
          { label: "Doctors", href: "/doctors" },
          { label: "Profile" },
        ]}
        onBack={() => router.push("/doctors")}
      >
        <Link href={`/doctors/${doctor.id}/edit`} className="w-full sm:w-auto">
          <Button className="w-full sm:w-auto gradient-primary rounded-xl shadow-md hover:shadow-lg transition-all font-bold px-6 h-11">
            <Pencil className="mr-2 size-4" /> Edit Profile
          </Button>
        </Link>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3 items-start">
        {/* Left Column - Profile Card */}
        <Card className="shadow-soft border-border/40 bg-card rounded-3xl overflow-hidden relative">
          <div className="h-24 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent absolute top-0 left-0 w-full" />
          <CardContent className="flex flex-col items-center p-6 pt-10 text-center relative z-10">
            <Avatar className="size-24 mb-5 border-4 border-card shadow-lg ring-1 ring-border/50">
              <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-3xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <h2 className="text-2xl font-extrabold tracking-tight">Dr. {doctor.user.firstName} {doctor.user.lastName}</h2>
            <p className="text-primary font-bold mt-0.5">{doctor.specialization}</p>
            
            <Badge className={`mt-4 px-4 py-1 font-bold border-0 shadow-none ${
              doctor.available 
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" 
                : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
            }`}>
              {doctor.available ? "Currently Available" : "Unavailable / On Leave"}
            </Badge>

            <div className="w-full space-y-4 text-left mt-8 bg-muted/30 p-5 rounded-2xl border border-border/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-background rounded-lg shadow-sm text-muted-foreground"><Mail className="size-4" /></div>
                <span className="font-semibold text-sm truncate">{doctor.user.email}</span>
              </div>
              {doctor.phone && (
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-background rounded-lg shadow-sm text-muted-foreground"><Phone className="size-4" /></div>
                  <span className="font-semibold text-sm">{doctor.phone}</span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className="p-2 bg-background rounded-lg shadow-sm text-muted-foreground"><Award className="size-4" /></div>
                <span className="font-semibold text-sm text-primary">{doctor.department.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-background rounded-lg shadow-sm text-muted-foreground"><GraduationCap className="size-4" /></div>
                <span className="font-semibold text-sm line-clamp-2">{doctor.qualification}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-background rounded-lg shadow-sm text-muted-foreground"><Clock className="size-4" /></div>
                <span className="font-semibold text-sm">{doctor.experience} years experience</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right Column - Stats & History */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="shadow-sm border-border/40 rounded-3xl overflow-hidden bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/50">
              <CardContent className="p-5 flex flex-col items-center text-center">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-xl mb-3"><CalendarDays className="size-5 text-blue-600 dark:text-blue-400" /></div>
                <p className="text-3xl font-black text-blue-700 dark:text-blue-400">{doctor._count.appointments}</p>
                <p className="text-xs font-bold uppercase tracking-wider text-blue-600/70 dark:text-blue-400/70 mt-1">Appointments</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm border-border/40 rounded-3xl overflow-hidden bg-teal-50/50 dark:bg-teal-900/10 border-teal-100 dark:border-teal-900/50">
              <CardContent className="p-5 flex flex-col items-center text-center">
                <div className="p-2 bg-teal-100 dark:bg-teal-900/50 rounded-xl mb-3"><FileText className="size-5 text-teal-600 dark:text-teal-400" /></div>
                <p className="text-3xl font-black text-teal-700 dark:text-teal-400">{doctor._count.medicalRecords}</p>
                <p className="text-xs font-bold uppercase tracking-wider text-teal-600/70 dark:text-teal-400/70 mt-1">Medical Records</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm border-border/40 rounded-3xl overflow-hidden bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-900/50">
              <CardContent className="p-5 flex flex-col items-center text-center">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-xl mb-3"><Pill className="size-5 text-indigo-600 dark:text-indigo-400" /></div>
                <p className="text-3xl font-black text-indigo-700 dark:text-indigo-400">{doctor._count.prescriptions}</p>
                <p className="text-xs font-bold uppercase tracking-wider text-indigo-600/70 dark:text-indigo-400/70 mt-1">Prescriptions</p>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-soft border-border/40 rounded-3xl overflow-hidden h-full">
            <CardHeader className="bg-muted/20 border-b border-border/30 pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <CalendarDays className="size-5 text-primary" /> Recent Appointments
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              {doctor.appointments.length === 0 ? (
                <div className="text-center py-10 px-4 border-2 border-dashed border-border/60 rounded-2xl bg-muted/20">
                  <p className="text-sm font-bold text-muted-foreground">No appointments history.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {doctor.appointments.map((apt) => (
                    <div key={apt.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-border/50 bg-background p-4 transition-all hover:shadow-md hover:border-primary/30">
                      <div className="flex items-center gap-4">
                        <div className="hidden sm:flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary font-bold">
                          {apt.patient.firstName[0]}{apt.patient.lastName[0]}
                        </div>
                        <div>
                          <p className="font-bold text-foreground text-lg">{apt.patient.firstName} {apt.patient.lastName}</p>
                          <p className="text-sm font-medium text-muted-foreground mt-0.5">
                            {format(new Date(apt.appointmentDate), "MMM dd, yyyy")} <span className="mx-1">•</span> <span className="font-bold text-primary">{apt.appointmentTime}</span>
                          </p>
                        </div>
                      </div>
                      <Badge className={`px-3 py-1 font-bold text-xs shadow-none border-0 w-fit ${
                        apt.status === "SCHEDULED" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" :
                        apt.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {apt.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}