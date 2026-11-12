"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { getMedicalRecordById } from "@/actions/medical-records";
import { ConsultationTests } from "@/components/lab/consultation-tests";
import { Breadcrumb } from "@/components/layouts/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { Loader2, Pencil, Plus, Pill, AlertCircle, FileText, User, Stethoscope, CalendarClock, ArrowLeft } from "lucide-react";
import { PageLoader } from "@/components/shared/page-loader";

export default function MedicalRecordDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMedicalRecordById(params.id).then((result) => {
      if (result.success) setRecord(result.data);
      else { toast.error(result.message); router.push("/medical-records"); }
      setLoading(false);
    });
  }, [params.id, router]);

  if (loading) {
    return (
      <PageLoader
        messages={[
          "Loading the records…",
          "Be patient, fetching clinical data…",
          "Decrypting patient information…",
          "Organizing medical history…",
        ]}
      />
    );
  }

  if (!record) return null;

  return (
    <div className="animate-in fade-in zoom-in-95 duration-500 space-y-6 max-w-6xl mx-auto">
      {/* Top Breadcrumb row */}
      <div>
        <Breadcrumb items={[{ label: "Medical Records", href: "/medical-records" }, { label: "Details" }]} />
      </div>

      {/* Header Row: Back button, Title & Action Buttons */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-2">
        <div className="flex items-start sm:items-center gap-3 sm:gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full hover:bg-muted shrink-0 mt-0.5 sm:mt-0"
            onClick={() => router.push("/medical-records")}
            title="Back to Medical Records"
          >
            <ArrowLeft className="size-5" />
          </Button>
          <div className="space-y-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground leading-tight">
              Medical Record
            </h1>
            <p className="text-sm sm:text-base font-medium text-muted-foreground leading-relaxed">
              {record.patient.firstName} {record.patient.lastName} &bull; {format(new Date(record.createdAt), "MMMM dd, yyyy")}
            </p>
          </div>
        </div>

        {/* Action Buttons: Responsive 2-col on mobile, flex row on desktop */}
        <div className="grid grid-cols-2 sm:flex items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
          <Link href={`/medical-records/${record.id}/edit`} className="w-full sm:w-auto">
            <Button variant="outline" className="w-full rounded-xl shadow-xs hover:bg-muted font-bold h-11 px-4 text-sm sm:text-base">
              <Pencil className="mr-2 size-4 text-muted-foreground" /> Edit
            </Button>
          </Link>
          <Link href={`/prescriptions/new?medicalRecordId=${record.id}`} className="w-full sm:w-auto">
            <Button className="w-full gradient-primary rounded-xl shadow-md hover:shadow-lg transition-all font-bold h-11 px-4 border-0 text-sm sm:text-base whitespace-nowrap">
              <Plus className="mr-2 size-4" /> Add Prescription
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3 items-start">
        {/* Left Column - Visit Meta Info */}
        <div className="space-y-6">
          <Card className="shadow-soft border-border/40 bg-card rounded-3xl overflow-hidden">
            <CardHeader className="bg-primary/5 border-b border-primary/10 pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <CalendarClock className="size-5 text-primary" /> Encounter Info
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/40">
                <div className="p-5 flex items-center gap-4 hover:bg-muted/30 transition-colors">
                  <div className="p-2.5 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 rounded-xl"><User className="size-5" /></div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Patient</p>
                    <p className="font-extrabold text-foreground">{record.patient.firstName} {record.patient.lastName}</p>
                  </div>
                </div>
                
                <div className="p-5 flex items-center gap-4 hover:bg-muted/30 transition-colors">
                  <div className="p-2.5 bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400 rounded-xl"><Stethoscope className="size-5" /></div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Consulting Doctor</p>
                    <p className="font-extrabold text-foreground">Dr. {record.doctor.user.firstName} {record.doctor.user.lastName}</p>
                    <p className="text-xs font-semibold text-primary">{record.doctor.department.name}</p>
                  </div>
                </div>

                <div className="p-5 hover:bg-muted/30 transition-colors">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Encounter Date</p>
                  <p className="font-bold text-foreground">{format(new Date(record.createdAt), "MMMM dd, yyyy")}</p>
                </div>

                {record.followUpDate && (
                  <div className="p-5 bg-amber-50/50 dark:bg-amber-900/10 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors">
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1 flex items-center gap-1.5">
                      <CalendarClock className="size-3.5" /> Follow-up Date
                    </p>
                    <p className="font-bold text-amber-900 dark:text-amber-200">{format(new Date(record.followUpDate), "MMMM dd, yyyy")}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Clinical Data */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-soft border-border/40 bg-card rounded-3xl overflow-hidden">
            <CardHeader className="bg-blue-50/50 dark:bg-blue-900/10 border-b border-border/30 pb-4">
              <CardTitle className="text-lg font-bold flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400 rounded-xl"><FileText className="size-5" /></div>
                Clinical Details
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {record.allergies && (
                <div className="rounded-2xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900 p-5 flex gap-4 animate-in slide-in-from-right-4">
                  <AlertCircle className="size-6 text-red-600 dark:text-red-400 shrink-0" />
                  <div>
                    <p className="text-sm font-extrabold text-red-800 dark:text-red-400 uppercase tracking-wider mb-1">Patient Allergies</p>
                    <p className="font-medium text-red-900 dark:text-red-200">{record.allergies}</p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border/50 pb-2">Presenting Symptoms</p>
                <div className="bg-muted/30 p-4 rounded-xl border border-border/40 text-foreground font-medium leading-relaxed">
                  {record.symptoms}
                </div>
              </div>
              
              <div className="space-y-2">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border/50 pb-2">Final Diagnosis</p>
                <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 text-foreground font-medium leading-relaxed">
                  {record.diagnosis}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border/50 pb-2">Treatment Plan</p>
                <div className="bg-muted/30 p-4 rounded-xl border border-border/40 text-foreground font-medium leading-relaxed">
                  {record.treatment}
                </div>
              </div>

              {record.doctorNotes && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border/50 pb-2">Confidential Notes</p>
                  <div className="bg-amber-50/30 dark:bg-amber-900/10 p-4 rounded-xl border border-amber-200/50 dark:border-amber-900/50 text-foreground font-medium leading-relaxed italic">
                    {record.doctorNotes}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-soft border-border/40 bg-card rounded-3xl overflow-hidden">
            <CardHeader className="bg-indigo-50/50 dark:bg-indigo-900/10 border-b border-border/30 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-bold flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400 rounded-xl"><Pill className="size-5" /></div>
                  Prescriptions
                </CardTitle>
                <Link href={`/prescriptions/new?medicalRecordId=${record.id}`}>
                  <Button size="sm" className="rounded-lg font-bold shadow-sm bg-indigo-600 hover:bg-indigo-700 text-white border-0">
                    <Plus className="mr-1 size-4" /> Add
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {record.prescriptions.length === 0 ? (
                <div className="text-center py-8 px-4 border-2 border-dashed border-border/60 rounded-2xl bg-muted/20">
                  <Pill className="size-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm font-bold text-muted-foreground">No prescriptions associated with this record.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {record.prescriptions.map((rx) => (
                    <div key={rx.id} className="rounded-2xl border border-border/60 bg-background overflow-hidden transition-all hover:shadow-md">
                      <div className="bg-muted/40 px-5 py-3 border-b border-border/40 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-primary font-bold">
                          <Pill className="size-4" /> Prescription Script
                        </div>
                        <Badge className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400 font-bold shadow-none border-0">
                          {format(new Date(rx.createdAt), "MMM dd, yyyy")}
                        </Badge>
                      </div>
                      <div className="p-5">
                        {rx.instructions && (
                          <div className="mb-4 bg-muted/30 p-3 rounded-xl">
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Instructions: </span>
                            <span className="text-sm font-medium">{rx.instructions}</span>
                          </div>
                        )}
                        <div className="space-y-2">
                          {rx.items.map((item) => (
                            <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-sm bg-background border border-border/50 p-3 rounded-xl">
                              <span className="font-extrabold text-foreground">{item.medicineName}</span>
                              <div className="flex gap-2">
                                <Badge variant="outline" className="font-semibold text-xs border-border/60">{item.dosage}</Badge>
                                <Badge variant="outline" className="font-semibold text-xs border-border/60">{item.frequency}</Badge>
                                <Badge variant="outline" className="font-semibold text-xs border-border/60 bg-muted/30">{item.duration}</Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ConsultationTests medicalRecordId={params.id} />
    </div>
  );
}
