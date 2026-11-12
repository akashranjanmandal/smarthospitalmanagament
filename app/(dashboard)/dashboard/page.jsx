import { prisma } from "@/lib/prisma";
import { ensureUser } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users, UserCog, CalendarDays, IndianRupee, Calendar, FileText, Pill, Receipt, ChevronRight, Activity, Clock
} from "lucide-react";
import Link from "next/link";
import { WardDashboard } from "@/components/inpatient/ward-dashboard";
import { CriticalAlerts } from "@/components/lab/critical-alerts";
import { canCreate } from "@/lib/permissions";

export default async function DashboardPage() {
  let user = null;
  let role = "PATIENT";

  try {
    user = await ensureUser();
    if (user) role = user.role;
  } catch (e) {
    console.error("Dashboard user lookup failed:", e.message);
  }

  if (role === "PATIENT" || !user) {
    return <PatientDashboard user={user} />;
  }
  if (role === "DOCTOR") {
    return <DoctorDashboard user={user} />;
  }
  if (role === "NURSE" || role === "WARD_ATTENDANT") {
    return <WardDashboard user={user} role={role} />;
  }
  return <AdminDashboard user={user} />;
}

// ----------------------------------------------------------------------
// ADMIN DASHBOARD
// ----------------------------------------------------------------------
async function AdminDashboard({ user }) {
  let patientCount = 0, doctorCount = 0, departmentCount = 0, todayAppointments = 0, pendingAppointments = 0, totalRevenue = 0, recentAppointments = [], recentPatients = [], recentPrescriptions = [];

  const results = await Promise.allSettled([
    prisma.patient.count(), prisma.doctor.count(), prisma.department.count(),
    prisma.appointment.count({ where: { appointmentDate: { gte: new Date(new Date().setHours(0,0,0,0)), lt: new Date(new Date().setDate(new Date().getDate()+1)) }, status: "SCHEDULED" } }),
    prisma.appointment.count({ where: { status: "SCHEDULED" } }),
    prisma.bill.aggregate({ _sum: { totalAmount: true }, where: { paymentStatus: "PAID" } }),
    prisma.appointment.findMany({ where: { status: "SCHEDULED" }, include: { doctor: { include: { user: true, department: true } }, patient: true }, orderBy: { appointmentDate: "asc" }, take: 5 }),
    prisma.patient.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.prescription.findMany({ orderBy: { createdAt: "desc" }, take: 5, include: { items: true, doctor: { include: { user: true } }, medicalRecord: { include: { patient: true } } } }),
  ]);

  const get = (i, fb) => results[i].status === "fulfilled" ? results[i].value : fb;
  patientCount = get(0, 0); doctorCount = get(1, 0); departmentCount = get(2, 0);
  todayAppointments = get(3, 0); pendingAppointments = get(4, 0);
  totalRevenue = get(5, { _sum: { totalAmount: 0 } })?._sum?.totalAmount || 0;
  recentAppointments = get(6, []); recentPatients = get(7, []); recentPrescriptions = get(8, []);

  const stats = [
    { title: "Total Patients", value: String(patientCount), description: "Registered patients", icon: Users },
    { title: "Total Doctors", value: String(doctorCount), description: "Active doctors", icon: UserCog },
    { title: "Today's Schedule", value: String(todayAppointments), description: `${pendingAppointments} pending total`, icon: CalendarDays },
    { title: "Revenue", value: `₹${totalRevenue.toFixed(0)}`, description: "From paid bills", icon: IndianRupee },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
          Welcome back{user?.firstName ? `, ${user.firstName}` : ""}
        </h1>
        <p className="text-lg font-medium text-muted-foreground">Hospital operations and daily overview.</p>
      </div>
      
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => <StatCard key={s.title} {...s} />)}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { title: "Register Patient", href: "/patients/new", icon: Users, color: "text-blue-600", module: "patients" },
          { title: "Book Appointment", href: "/appointments/new", icon: Calendar, color: "text-teal-600", module: "appointments" },
          { title: "Admit Patient", href: "/admissions/new", icon: Activity, color: "text-rose-600", module: "admissions" },
          { title: "Medical Record", href: "/medical-records/new", icon: FileText, color: "text-indigo-600", module: "medicalRecords" },
          { title: "Generate Bill", href: "/billing/new", icon: IndianRupee, color: "text-emerald-600", module: "billing" }
        ].filter((a) => canCreate(a.module, user.role)).slice(0, 4).map((a) => (
          <Link key={a.title} href={a.href} className="group block">
            <div className="flex items-center gap-4 rounded-2xl border border-border/50 bg-card p-4 transition-all duration-300 hover:shadow-hover hover:-translate-y-1 hover:border-primary/40">
              <div className={`rounded-xl bg-muted/60 p-3 transition-colors duration-300 group-hover:bg-primary/10 ${a.color}`}>
                <a.icon className="size-5" />
              </div>
              <span className="font-bold text-foreground group-hover:text-primary transition-colors">{a.title}</span>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="shadow-soft border-border/40 rounded-3xl overflow-hidden">
          <CardHeader className="bg-muted/20 border-b border-border/30 pb-4">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <CalendarDays className="size-4 text-primary" /> Upcoming Appointments
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {recentAppointments.length === 0 ? (
              <p className="text-sm font-medium text-muted-foreground text-center py-6">No upcoming appointments.</p>
            ) : (
              <div className="space-y-3">
                {recentAppointments.map((apt) => (
                  <Link key={apt.id} href={`/appointments/${apt.id}`} className="block group">
                    <div className="flex items-center justify-between rounded-xl border border-border/50 bg-background p-3 transition-all duration-200 hover:border-primary/30 hover:bg-primary/5 hover:shadow-sm">
                      <div>
                        <p className="font-bold text-foreground group-hover:text-primary transition-colors">{apt.patient.firstName} {apt.patient.lastName}</p>
                        <p className="text-xs font-medium text-muted-foreground mt-0.5">Dr. {apt.doctor.user.firstName} {apt.doctor.user.lastName}</p>
                      </div>
                      <Badge className="font-bold bg-primary/10 text-primary hover:bg-primary/20 shadow-none border-0">{apt.appointmentTime}</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-soft border-border/40 rounded-3xl overflow-hidden">
          <CardHeader className="bg-muted/20 border-b border-border/30 pb-4">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Users className="size-4 text-teal-600" /> Recent Patients
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {recentPatients.length === 0 ? (
              <p className="text-sm font-medium text-muted-foreground text-center py-6">No patients yet.</p>
            ) : (
              <div className="space-y-3">
                {recentPatients.map((p) => (
                  <Link key={p.id} href={`/patients/${p.id}`} className="block group">
                    <div className="flex items-center justify-between rounded-xl border border-border/50 bg-background p-3 transition-all duration-200 hover:border-teal-500/30 hover:bg-teal-50/50 hover:shadow-sm dark:hover:bg-teal-900/10">
                      <div>
                        <p className="font-bold text-foreground group-hover:text-teal-600 transition-colors">{p.firstName} {p.lastName}</p>
                        <p className="text-xs font-medium text-muted-foreground mt-0.5">{p.phone || "No phone"}</p>
                      </div>
                      <Badge variant="outline" className="font-semibold text-xs border-border/60 bg-muted/30">{p.gender}</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-soft border-border/40 rounded-3xl overflow-hidden">
          <CardHeader className="bg-muted/20 border-b border-border/30 pb-4">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Pill className="size-4 text-indigo-600" /> Latest Prescriptions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {recentPrescriptions.length === 0 ? (
              <p className="text-sm font-medium text-muted-foreground text-center py-6">No prescriptions yet.</p>
            ) : (
              <div className="space-y-3">
                {recentPrescriptions.map((rx) => (
                  <Link key={rx.id} href={`/prescriptions/${rx.id}`} className="block group">
                    <div className="rounded-xl border border-border/50 bg-background p-3 transition-all duration-200 hover:border-indigo-500/30 hover:bg-indigo-50/50 hover:shadow-sm dark:hover:bg-indigo-900/10">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-foreground group-hover:text-indigo-600 transition-colors truncate pr-2">
                          {rx.medicalRecord?.patient?.firstName} {rx.medicalRecord?.patient?.lastName}
                        </p>
                        <Badge className="font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border-0 shadow-none shrink-0">
                          {rx.items.length} med(s)
                        </Badge>
                      </div>
                      <p className="text-xs font-medium text-muted-foreground mt-1">Dr. {rx.doctor.user.firstName} {rx.doctor.user.lastName}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// DOCTOR DASHBOARD
// ----------------------------------------------------------------------
async function DoctorDashboard({ user }) {
  let doctor = null;
  try { doctor = await prisma.doctor.findUnique({ where: { userId: user.id }, include: { department: true } }); } catch (e) {}

  let todayAppointments = [], upcomingAppointments = [], recentPatients = [];

  if (doctor) {
    const today = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate()+1);

    const results = await Promise.allSettled([
      prisma.appointment.findMany({ where: { doctorId: doctor.id, appointmentDate: { gte: today, lt: tomorrow }, status: "SCHEDULED" }, include: { patient: true }, orderBy: { appointmentTime: "asc" } }),
      prisma.appointment.findMany({ where: { doctorId: doctor.id, status: "SCHEDULED", appointmentDate: { gte: tomorrow } }, include: { patient: true }, orderBy: { appointmentDate: "asc" }, take: 5 }),
      prisma.patient.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    ]);

    todayAppointments = results[0].status === "fulfilled" ? results[0].value : [];
    upcomingAppointments = results[1].status === "fulfilled" ? results[1].value : [];
    recentPatients = results[2].status === "fulfilled" ? results[2].value : [];
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <CriticalAlerts />
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
          Dr. {user?.firstName} {user?.lastName}
        </h1>
        <p className="text-lg font-medium text-muted-foreground">
          {doctor?.department?.name} &bull; {doctor?.specialization || "General"}
        </p>
      </div>
      
      <div className="grid gap-5 sm:grid-cols-3">
        <StatCard title="Today's Appointments" value={String(todayAppointments.length)} description="Scheduled for today" icon={Clock} />
        <StatCard title="Upcoming" value={String(upcomingAppointments.length)} description="Future appointments" icon={CalendarDays} />
        <StatCard title="Availability" value={doctor?.available ? "Available" : "Busy"} description="Current status" icon={Activity} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-soft border border-border/50 bg-card rounded-3xl overflow-hidden">
          <CardHeader className="bg-primary/5 border-b border-border/50 pb-4">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-primary">
              <Clock className="size-4" /> Today's Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {todayAppointments.length === 0 ? (
              <div className="text-center py-8 px-4 rounded-2xl border-2 border-dashed border-muted-foreground/30 bg-muted/20">
                <p className="text-sm font-bold text-muted-foreground">No appointments today.</p>
                <p className="text-xs font-medium text-muted-foreground mt-1">Enjoy your free time or catch up on records.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {todayAppointments.map((apt) => (
                  <div key={apt.id} className="group flex flex-col sm:flex-row sm:items-center justify-between rounded-xl border-l-4 border-l-primary border border-border/50 bg-background p-4 shadow-sm transition-all hover:shadow-md hover:bg-muted/20">
                    <div className="mb-3 sm:mb-0">
                      <p className="font-bold text-foreground text-base">{apt.patient.firstName} {apt.patient.lastName}</p>
                      {apt.reason && <p className="text-sm font-medium text-muted-foreground mt-0.5 line-clamp-1">{apt.reason}</p>}
                    </div>
                    <Badge className="sm:self-center w-fit font-bold bg-primary/10 text-primary border-0 shadow-none px-3 py-1 text-sm">
                      {apt.appointmentTime}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-soft border border-border/50 bg-card rounded-3xl overflow-hidden">
          <CardHeader className="bg-muted/15 border-b border-border/50 pb-4">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Calendar className="size-4 text-foreground/70" /> Upcoming Appointments
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {upcomingAppointments.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-muted-foreground/30 bg-muted/20 px-4 py-8 text-center">
                <p className="text-sm font-medium text-muted-foreground">No upcoming appointments scheduled.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingAppointments.map((apt) => (
                  <div key={apt.id} className="flex items-center justify-between rounded-xl border border-border/50 bg-background p-4 transition-all hover:border-border hover:bg-muted/30">
                    <div>
                      <p className="font-bold text-foreground">{apt.patient.firstName} {apt.patient.lastName}</p>
                      <p className="text-xs font-medium text-muted-foreground mt-0.5">
                        {new Date(apt.appointmentDate).toLocaleDateString("en-US", { weekday: 'short', month: 'short', day: 'numeric' })} at {apt.appointmentTime}
                      </p>
                    </div>
                    <ChevronRight className="size-5 text-muted-foreground/50" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// PATIENT DASHBOARD
// ----------------------------------------------------------------------
async function PatientDashboard({ user }) {
  let patient = user?.patient || null;
  let upcomingAppointments = [], recentRecords = [], latestPrescription = null, unpaidBills = [];

  if (patient) {
    const results = await Promise.allSettled([
      prisma.appointment.findMany({ where: { patientId: patient.id, status: "SCHEDULED" }, include: { doctor: { include: { user: true, department: true } } }, orderBy: { appointmentDate: "asc" }, take: 5 }),
      prisma.medicalRecord.findMany({ where: { patientId: patient.id }, include: { doctor: { include: { user: true } } }, orderBy: { createdAt: "desc" }, take: 3 }),
      prisma.prescription.findFirst({ where: { medicalRecord: { patientId: patient.id } }, include: { items: true, doctor: { include: { user: true } } }, orderBy: { createdAt: "desc" } }),
      prisma.bill.findMany({ where: { patientId: patient.id, paymentStatus: "PENDING" }, orderBy: { createdAt: "desc" }, take: 5 }),
    ]);

    upcomingAppointments = results[0].status === "fulfilled" ? results[0].value : [];
    recentRecords = results[1].status === "fulfilled" ? results[1].value : [];
    latestPrescription = results[2].status === "fulfilled" ? results[2].value : null;
    unpaidBills = results[3].status === "fulfilled" ? results[3].value : [];
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
          Welcome{user?.firstName ? `, ${user.firstName}` : ""}
        </h1>
        <p className="text-lg font-medium text-muted-foreground">Your personal health dashboard.</p>
      </div>

      {!patient ? (
        <Card className="shadow-hover border-border/40 rounded-[2rem] overflow-hidden">
          <CardContent className="p-10 text-center flex flex-col items-center justify-center min-h-[300px] bg-gradient-to-b from-card to-primary/5">
            <div className="bg-primary/10 p-5 rounded-full mb-6">
              <UserCog className="size-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Complete Your Profile</h2>
            <p className="text-muted-foreground font-medium mb-8 max-w-sm">
              Please complete your patient profile to book appointments and access medical records.
            </p>
            <Link href="/complete-profile">
              <Button className="gradient-primary h-12 px-8 rounded-xl font-bold text-base shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">
                Complete Profile
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Upcoming Visits" value={String(upcomingAppointments.length)} description="Appointments scheduled" icon={CalendarDays} />
            <StatCard title="Health Records" value={String(recentRecords.length)} description="Saved medical records" icon={FileText} />
            <StatCard title="Prescriptions" value={latestPrescription ? "1" : "0"} description="Active prescriptions" icon={Pill} />
            <StatCard title="Pending Bills" value={String(unpaidBills.length)} description="Invoices due" icon={IndianRupee} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { title: "Book Appointment", href: "/appointments/new", icon: Calendar, bg: "bg-blue-50 dark:bg-blue-900/20", color: "text-blue-600" },
              { title: "Medical History", href: "/medical-records", icon: FileText, bg: "bg-teal-50 dark:bg-teal-900/20", color: "text-teal-600" },
              { title: "View Bills", href: "/billing", icon: IndianRupee, bg: "bg-amber-50 dark:bg-amber-900/20", color: "text-amber-600" }
            ].map((a) => (
              <Link key={a.title} href={a.href} className="group block">
                <div className="flex items-center gap-4 rounded-2xl border border-border/50 bg-card p-4 transition-all duration-300 hover:shadow-hover hover:-translate-y-1 hover:border-border">
                  <div className={`rounded-xl p-3 transition-transform duration-300 group-hover:scale-110 ${a.bg}`}>
                    <a.icon className={`size-5 ${a.color}`} />
                  </div>
                  <span className="font-bold text-foreground">{a.title}</span>
                </div>
              </Link>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2 items-start">
            <div className="space-y-6">
              <Card className="shadow-soft border-border/40 rounded-3xl overflow-hidden">
                <CardHeader className="bg-muted/20 border-b border-border/30 pb-4">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <CalendarDays className="size-4 text-primary" /> Upcoming Appointments
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  {upcomingAppointments.length === 0 ? (
                    <div className="text-center py-6">
                      <p className="text-sm font-medium text-muted-foreground mb-3">No upcoming appointments.</p>
                      <Link href="/appointments/new">
                        <Button variant="outline" size="sm" className="rounded-full font-bold">Book one now</Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {upcomingAppointments.map((apt) => (
                        <div key={apt.id} className="flex items-center justify-between rounded-xl border border-border/50 bg-background p-3.5 transition-all hover:border-primary/30 hover:shadow-sm">
                          <div>
                            <p className="font-bold text-foreground text-base">Dr. {apt.doctor.user.firstName} {apt.doctor.user.lastName}</p>
                            <p className="text-xs font-semibold text-primary mt-0.5">{apt.doctor.department.name}</p>
                          </div>
                          <div className="text-right">
                            <Badge className="font-bold bg-muted text-foreground border-border/60 mb-1">
                              {new Date(apt.appointmentDate).toLocaleDateString("en-US", { month: 'short', day: 'numeric' })}
                            </Badge>
                            <p className="text-xs font-bold text-muted-foreground">{apt.appointmentTime}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {latestPrescription && (
                <Card className="shadow-soft border-emerald-200 dark:border-emerald-900/50 rounded-3xl overflow-hidden bg-emerald-50/30 dark:bg-emerald-900/10">
                  <CardHeader className="bg-emerald-100/50 dark:bg-emerald-900/30 border-b border-emerald-200/50 dark:border-emerald-800 pb-4">
                    <CardTitle className="text-base font-bold flex items-center gap-2 text-emerald-800 dark:text-emerald-400">
                      <Pill className="size-4" /> Latest Prescription
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-background p-4">
                      <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/40">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Prescribed By</p>
                          <p className="font-bold text-foreground mt-0.5">Dr. {latestPrescription.doctor.user.firstName} {latestPrescription.doctor.user.lastName}</p>
                        </div>
                        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-0 font-bold">
                          {latestPrescription.items.length} med(s)
                        </Badge>
                      </div>
                      <div className="space-y-3">
                        {latestPrescription.items.map((item) => (
                          <div key={item.id} className="flex justify-between items-center text-sm bg-muted/40 p-2.5 rounded-lg">
                            <span className="font-bold text-foreground">{item.medicineName}</span>
                            <span className="font-medium text-muted-foreground">{item.dosage} &bull; {item.frequency}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <Card className="shadow-soft border-border/40 rounded-3xl overflow-hidden h-full">
              <CardHeader className="bg-muted/20 border-b border-border/30 pb-4">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <FileText className="size-4 text-teal-600" /> Recent Medical Records
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {recentRecords.length === 0 ? (
                  <p className="text-sm font-medium text-muted-foreground text-center py-6">No medical records on file.</p>
                ) : (
                  <div className="space-y-3">
                    {recentRecords.map((r) => (
                      <Link key={r.id} href={`/medical-records/${r.id}`} className="block group">
                        <div className="rounded-xl border border-border/50 bg-background p-4 transition-all hover:border-teal-500/30 hover:bg-teal-50/50 dark:hover:bg-teal-900/10 hover:shadow-sm">
                          <div className="flex items-start justify-between mb-2">
                            <p className="font-bold text-foreground text-base line-clamp-1 group-hover:text-teal-600 transition-colors">
                              {r.diagnosis || "General Consultation"}
                            </p>
                            <span className="text-xs font-bold text-muted-foreground whitespace-nowrap ml-3">
                              {new Date(r.createdAt).toLocaleDateString("en-US")}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                            <UserCog className="size-3.5" /> Dr. {r.doctor.user.firstName} {r.doctor.user.lastName}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}