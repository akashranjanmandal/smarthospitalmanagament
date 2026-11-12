"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { getDepartmentById } from "@/actions/departments";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Pencil, Loader2, UserCog, Phone, Building2, CalendarDays, ArrowLeft } from "lucide-react";
import { PageLoader } from "@/components/shared/page-loader";
import { toast } from "sonner";

export default function DepartmentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [department, setDepartment] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDepartment() {
      const result = await getDepartmentById(params.id);
      if (result.success) {
        setDepartment(result.data);
      } else {
        toast.error(result.message);
        router.push("/departments");
      }
      setLoading(false);
    }
    fetchDepartment();
  }, [params.id, router]);

  if (loading) {
    return (
      <PageLoader
        messages={[
          "Loading department info…",
          "Fetching team members…",
          "Organizing clinical data…",
          "Almost there…",
        ]}
      />
    );
  }

  if (!department) return null;

  return (
    <div className="animate-in fade-in zoom-in-95 duration-500 space-y-6">
      <PageHeader
        title={department.name}
        description={department.description || "No description provided for this department."}
        breadcrumbs={[
          { label: "Departments", href: "/departments" },
          { label: department.name },
        ]}
        onBack={() => router.push("/departments")}
      >
        <Link href={`/departments/${department.id}/edit`} className="w-full sm:w-auto">
          <Button className="w-full sm:w-auto gradient-primary rounded-xl shadow-md hover:shadow-lg transition-all font-bold h-11">
            <Pencil className="mr-2 size-4" /> Edit Department
          </Button>
        </Link>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3 items-start">
        {/* Left Column - Meta Data */}
        <Card className="shadow-soft border-border/40 bg-card rounded-3xl overflow-hidden">
          <CardHeader className="bg-primary/5 border-b border-primary/10 pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl text-primary"><Building2 className="size-5" /></div>
              Department Info
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-5">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Status</p>
              <Badge className={`px-3 py-1 font-bold ${
                department.status === "ACTIVE" 
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 hover:bg-emerald-100 border-0 shadow-none" 
                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 hover:bg-amber-100 border-0 shadow-none"
              }`}>
                {department.status}
              </Badge>
            </div>
            
            <div className="rounded-2xl bg-muted/40 p-5 border border-border/50">
              <div className="flex items-center gap-3 mb-1">
                <UserCog className="size-5 text-primary" />
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Total Doctors</p>
              </div>
              <p className="text-4xl font-extrabold text-foreground mt-2">{department._count.doctors}</p>
            </div>
            
            <div className="pt-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <CalendarDays className="size-3.5" /> Date Created
              </p>
              <p className="font-semibold text-foreground">
                {new Date(department.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Right Column - Doctors List */}
        <Card className="lg:col-span-2 shadow-soft border-border/40 bg-card rounded-3xl overflow-hidden">
          <CardHeader className="bg-teal-50/50 dark:bg-teal-900/10 border-b border-border/30 pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-3">
              <div className="p-2 bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400 rounded-xl"><UserCog className="size-5" /></div>
              Assigned Specialists
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {department.doctors.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center border-2 border-dashed border-border/60 rounded-2xl bg-muted/20">
                <div className="bg-muted p-4 rounded-full mb-4">
                  <UserCog className="size-10 text-muted-foreground/50" />
                </div>
                <p className="text-lg font-bold text-foreground">No doctors assigned yet</p>
                <p className="text-sm font-medium text-muted-foreground mt-1 max-w-sm">
                  Add doctors to this department from the main Doctors module to see them listed here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {department.doctors.map((doctor) => (
                  <div
                    key={doctor.id}
                    className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-border/60 bg-background p-4 transition-all duration-300 hover:shadow-md hover:border-primary/40 hover:-translate-y-0.5"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 transition-colors group-hover:bg-primary group-hover:text-white text-primary">
                        <UserCog className="size-6" />
                      </div>
                      <div>
                        <p className="font-bold text-foreground text-lg">
                          Dr. {doctor.user.firstName} {doctor.user.lastName}
                        </p>
                        <p className="text-sm font-semibold text-muted-foreground mt-0.5">
                          {doctor.specialization || "Generalist"}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 pl-16 sm:pl-0">
                      {doctor.phone && (
                        <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                          <Phone className="size-3.5" /> {doctor.phone}
                        </div>
                      )}
                      <Badge className={`font-bold shadow-none border-0 ${
                        doctor.available 
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" 
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {doctor.available ? "Available" : "Unavailable"}
                      </Badge>
                    </div>
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