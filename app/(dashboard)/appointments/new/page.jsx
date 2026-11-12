"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createAppointment } from "@/actions/appointments";
import { getAllDoctors } from "@/actions/doctors";
import { getAllPatients } from "@/actions/patients";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { FormSelect } from "@/components/shared/form-select";
import { useRole } from "@/hooks/use-role";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  Stethoscope,
  UserRound,
} from "lucide-react";

const SLOT_GROUPS = [
  {
    title: "Morning",
    slots: ["08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30"],
  },
  {
    title: "Afternoon",
    slots: ["12:00", "12:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"],
  },
  {
    title: "Evening",
    slots: ["17:00", "17:30", "18:00", "18:30", "19:00"],
  },
];

const STEPS = [
  { id: 1, title: "Patient", icon: UserRound },
  { id: 2, title: "Doctor", icon: Stethoscope },
  { id: 3, title: "Schedule", icon: CalendarDays },
];

function formatSlot(time) {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

export default function NewAppointmentPage() {
  const router = useRouter();
  const { role, user } = useRole();
  const isPatient = role === "PATIENT";

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [deptFilter, setDeptFilter] = useState("all");

  const [form, setForm] = useState({
    patientId: "",
    doctorId: "",
    appointmentDate: "",
    appointmentTime: "",
    reason: "",
    notes: "",
  });
  const [errors, setErrors] = useState({});

  const isPastSlot = (slotTime) => {
    if (!form.appointmentDate) return false;
    const now = new Date();

    const [year, month, day] = form.appointmentDate.split("-").map(Number);
    const selectedDate = new Date(year, month - 1, day);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (selectedDate < today) return true;
    if (selectedDate > today) return false;

    // Selected date is TODAY - check if slot time has passed
    const [h, m] = slotTime.split(":").map(Number);
    const slotDateTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);

    return slotDateTime < now;
  };

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    async function load() {
      const [docRes, patRes] = await Promise.all([getAllDoctors(), getAllPatients()]);
      if (docRes.success) setDoctors(docRes.data || []);
      if (patRes.success) setPatients(patRes.data || []);

      if (isPatient && user?.patient?.id) {
        setForm((prev) => ({ ...prev, patientId: user.patient.id }));
      }
    }
    load();
  }, [isPatient, user]);

  const departments = useMemo(() => {
    const map = new Map();
    doctors.forEach((d) => {
      if (d.department?.id) map.set(d.department.id, d.department.name);
    });
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [doctors]);

  const filteredDoctors = useMemo(() => {
    if (deptFilter === "all") return doctors;
    return doctors.filter((d) => d.departmentId === deptFilter || d.department?.id === deptFilter);
  }, [doctors, deptFilter]);

  const selectedPatient = patients.find((p) => p.id === form.patientId);
  const selectedDoctor = doctors.find((d) => d.id === form.doctorId);

  const availableDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      return d.toISOString().split("T")[0];
    });
  }, []);

  const validateStep = (current) => {
    const next = {};
    if (current === 1 && !isPatient && !form.patientId) next.patientId = "Select a patient";
    if (current === 2 && !form.doctorId) next.doctorId = "Select a doctor";
    if (current === 3) {
      if (!form.appointmentDate) next.appointmentDate = "Select a date";
      if (!form.appointmentTime) next.appointmentTime = "Select a time slot";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(3, s + 1));
  };

  const goBack = () => setStep((s) => Math.max(1, s - 1));

  const onSubmit = async () => {
    if (!validateStep(3)) return;
    setLoading(true);
    const result = await createAppointment(form);
    setLoading(false);
    if (result.success) {
      toast.success(result.message);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("refresh-notifications"));
      }
      router.push("/appointments");
    } else {
      toast.error(result.message);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="Book Appointment"
        description="Complete the booking in 3 simple steps"
        breadcrumbs={[
          { label: "Appointments", href: "/appointments" },
          { label: "Book" },
        ]}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        {STEPS.map((item) => {
          const Icon = item.icon;
          const active = step === item.id;
          const done = step > item.id;
          return (
            <div
              key={item.id}
              className={`rounded-2xl border p-4 transition-all duration-300 relative overflow-hidden ${
                active ? "border-primary bg-primary/5 shadow-md scale-[1.02]" : done ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20" : "bg-card border-border/40 opacity-70"
              }`}
            >
              {active && <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-primary to-accent" />}
              <div className="flex items-center gap-3 min-w-0">
                <div className={`rounded-xl p-2.5 transition-colors ${active ? "bg-primary text-white shadow-lg shadow-primary/30" : done ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>
                  {done ? <CheckCircle2 className="size-5" /> : <Icon className="size-5" />}
                </div>
                <div className="min-w-0">
                  <p className={`text-xs font-bold uppercase tracking-wider ${active ? "text-primary" : "text-muted-foreground"}`}>Step {item.id}</p>
                  <p className={`text-sm font-extrabold ${active ? "text-foreground" : "text-muted-foreground"}`}>{item.title}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Card className="shadow-soft border-border/40 bg-card rounded-3xl overflow-hidden">
        <CardContent className="p-5 sm:p-8">
          <div className="min-h-87.5 animate-in fade-in slide-in-from-right-4 duration-300">
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-extrabold tracking-tight">Patient Information</h2>
                  <p className="text-muted-foreground font-medium mt-1">Who is this appointment for?</p>
                </div>

                {isPatient ? (
                  <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-4 sm:p-6 shadow-inner flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-xl font-bold text-foreground">
                        {user?.firstName} {user?.lastName}
                      </p>
                      <p className="text-sm font-medium text-muted-foreground mt-1 wrap-break-word">{user?.email && !user.email.endsWith("@phone.local") ? user.email : user?.phone}</p>
                    </div>
                    <Badge className="bg-primary hover:bg-primary px-3 py-1 font-bold whitespace-normal text-center h-auto">Booking for yourself</Badge>
                  </div>
                ) : (
                  <div className="space-y-3 max-w-lg">
                    <Label className="font-bold text-sm">Select Patient <span className="text-destructive">*</span></Label>
                    <FormSelect
                      options={patients.map((p) => ({
                        value: p.id,
                        label: `${p.firstName} ${p.lastName} • ${p.phone || "No phone"}`,
                      }))}
                      value={form.patientId}
                      onValueChange={(v) => setField("patientId", v)}
                      placeholder="Search and choose patient..."
                    />
                    {errors.patientId && <p className="text-sm font-semibold text-destructive animate-in slide-in-from-top-1">{errors.patientId}</p>}
                    
                    {selectedPatient && (
                      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 mt-4 animate-in fade-in zoom-in-95">
                        <p className="font-bold text-foreground wrap-break-word">{selectedPatient.firstName} {selectedPatient.lastName}</p>
                        <p className="text-sm font-medium text-muted-foreground mt-1 wrap-break-word">
                          {selectedPatient.gender} • DOB {new Date(selectedPatient.dateOfBirth).toLocaleDateString("en-US")}
                          {selectedPatient.bloodGroup ? ` • ${selectedPatient.bloodGroup}` : ""}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-extrabold tracking-tight">Choose Doctor</h2>
                    <p className="text-muted-foreground font-medium mt-1">Select a specialist for your consultation</p>
                  </div>
                  <div className="w-full max-w-xs space-y-2">
                    <Label className="font-bold text-sm">Filter by Department</Label>
                    <FormSelect
                      options={[{ value: "all", label: "All departments" }, ...departments]}
                      value={deptFilter}
                      onValueChange={setDeptFilter}
                      placeholder="All departments"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {filteredDoctors.map((doctor) => {
                    const selected = form.doctorId === doctor.id;
                    return (
                      <button
                        key={doctor.id}
                        type="button"
                        onClick={() => setField("doctorId", doctor.id)}
                        className={`group rounded-2xl border-2 p-5 text-left transition-all duration-300 hover:shadow-hover hover:-translate-y-1 ${
                          selected ? "border-primary bg-primary/5 shadow-md ring-1 ring-primary/20" : "border-border/40 bg-background"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className={`p-3 rounded-full transition-colors ${selected ? "bg-primary text-white" : "bg-muted text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary"}`}>
                              <Stethoscope className="size-5" />
                            </div>
                            <div>
                              <p className="font-bold text-lg text-foreground">
                                Dr. {doctor.user?.firstName} {doctor.user?.lastName}
                              </p>
                              <p className="text-sm font-semibold text-muted-foreground">
                                {doctor.specialization || "General"} • {doctor.department?.name || "Department"}
                              </p>
                            </div>
                          </div>
                          {selected && <CheckCircle2 className="size-6 text-primary animate-in zoom-in" />}
                        </div>
                        <div className="mt-4 flex gap-2 ml-14">
                          <Badge className={doctor.available ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-muted text-muted-foreground"}>
                            {doctor.available ? "Available" : "Busy"}
                          </Badge>
                          {doctor.experience != null && <Badge variant="outline" className="font-semibold">{doctor.experience} yrs exp</Badge>}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {errors.doctorId && <p className="text-sm font-semibold text-destructive animate-in slide-in-from-top-1">{errors.doctorId}</p>}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-2xl font-extrabold tracking-tight">Date & Time Slot</h2>
                  <p className="text-muted-foreground font-medium mt-1">Pick a convenient schedule for your visit</p>
                </div>

                <div className="space-y-3">
                  <Label className="font-bold text-sm">Select Date <span className="text-destructive">*</span></Label>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-7">
                    {availableDates.map((date) => {
                      const d = new Date(date);
                      const selected = form.appointmentDate === date;
                      return (
                        <button
                          key={date}
                          type="button"
                          onClick={() => setField("appointmentDate", date)}
                          className={`rounded-2xl border-2 py-3 px-1 text-center transition-all duration-200 ${
                            selected ? "border-primary gradient-primary text-white shadow-md transform scale-105" : "border-border/40 bg-background hover:border-primary/40 hover:bg-primary/5"
                          }`}
                        >
                          <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${selected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                            {d.toLocaleDateString("en-GB", { weekday: "short" })}
                          </p>
                          <p className="text-lg font-extrabold">
                            {d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                  {errors.appointmentDate && <p className="text-sm font-semibold text-destructive">{errors.appointmentDate}</p>}
                </div>

                <div className="space-y-6">
                  <Label className="font-bold text-sm flex items-center gap-2">
                    <Clock3 className="size-4 text-primary" /> Select Time Slot <span className="text-destructive">*</span>
                  </Label>

                  {SLOT_GROUPS.map((group) => {
                    return (
                      <div key={group.title} className="space-y-2.5">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                          {group.title}
                        </h4>
                        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-7">
                          {group.slots.map((slot) => {
                            const selected = form.appointmentTime === slot;
                            const isPast = isPastSlot(slot);
                            return (
                              <button
                                key={slot}
                                type="button"
                                disabled={isPast}
                                onClick={() => setField("appointmentTime", slot)}
                                className={`rounded-full border py-2.5 px-4 text-sm font-bold transition-all duration-200 ${
                                  isPast
                                    ? "border-slate-200/50 bg-slate-100/40 text-slate-400/50 dark:bg-slate-800/30 dark:text-slate-600 cursor-not-allowed opacity-40 line-through select-none"
                                    : selected
                                    ? "border-primary gradient-primary text-white shadow-md scale-105"
                                    : "border-slate-200/80 bg-slate-100/70 dark:bg-slate-800/40 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:bg-primary/10 hover:border-primary/40"
                                }`}
                              >
                                {formatSlot(slot)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {errors.appointmentTime && <p className="text-sm font-semibold text-destructive">{errors.appointmentTime}</p>}
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="font-bold text-sm">Reason for visit</Label>
                    <Textarea
                      rows={3}
                      placeholder="e.g. Fever, follow-up, consultation"
                      value={form.reason}
                      onChange={(e) => setField("reason", e.target.value)}
                      className="rounded-xl bg-background/50 resize-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold text-sm">Additional Notes</Label>
                    <Textarea
                      rows={3}
                      placeholder="Optional notes for the doctor"
                      value={form.notes}
                      onChange={(e) => setField("notes", e.target.value)}
                      className="rounded-xl bg-background/50 resize-none"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border-2 border-border/40 bg-muted/30 p-5">
                  <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Booking Summary</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold mb-1">Patient</p>
                      <p className="font-bold text-sm">{isPatient ? `${user?.firstName || ""} ${user?.lastName || ""}` : `${selectedPatient?.firstName || "-"} ${selectedPatient?.lastName || ""}`}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold mb-1">Doctor</p>
                      <p className="font-bold text-sm">{selectedDoctor ? `Dr. ${selectedDoctor.user?.firstName} ${selectedDoctor.user?.lastName}` : "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold mb-1">Schedule</p>
                      <p className="font-bold text-sm text-primary">
                        {form.appointmentDate ? format(new Date(form.appointmentDate), "MMM dd") : "-"} 
                        {form.appointmentTime ? ` at ${formatSlot(form.appointmentTime)}` : ""}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-border/40 pt-6 mt-6">
            <Button type="button" variant="outline" className="rounded-xl h-11 font-bold" onClick={goBack} disabled={step === 1 || loading}>
              <ChevronLeft className="mr-1 size-4" /> Go Back
            </Button>

            {step < 3 ? (
              <Button type="button" className="gradient-primary border-0 rounded-xl h-11 px-6 font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all" onClick={goNext}>
                Continue <ChevronRight className="ml-1 size-4" />
              </Button>
            ) : (
              <Button type="button" className="gradient-accent border-0 rounded-xl h-11 px-6 font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all" onClick={onSubmit} disabled={loading}>
                {loading ? <Loader2 className="mr-2 size-5 animate-spin" /> : <CheckCircle2 className="mr-2 size-5" />}
                Confirm Booking
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}