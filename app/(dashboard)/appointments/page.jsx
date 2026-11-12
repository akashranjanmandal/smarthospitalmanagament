"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getAppointments, cancelAppointment, completeAppointment } from "@/actions/appointments";
import { useRole } from "@/hooks/use-role";
import { Plus, Search, MoreHorizontal, Eye, XCircle, CheckCircle, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function AppointmentsPage() {
  const router = useRouter();
  const { isPatient } = useRole();

  const [appointments, setAppointments] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [cancelId, setCancelId] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    const result = await getAppointments({
      search: search || undefined,
      status: statusFilter !== "all" ? statusFilter : undefined,
      page,
      limit: 10,
    });

    if (result.success) {
      setAppointments(result.data);
      setPagination(result.pagination);
    } else {
      toast.error(result.message);
    }
    setLoading(false);
  }, [search, statusFilter, page]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const handleCancel = async () => {
    if (!cancelId) return;
    setCancelling(true);
    const result = await cancelAppointment(cancelId);
    if (result.success) {
      toast.success(result.message);
      fetchAppointments();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("refresh-notifications"));
      }
    } else {
      toast.error(result.message);
    }
    setCancelling(false);
    setCancelId(null);
  };

  const handleComplete = async (id) => {
    const result = await completeAppointment(id);
    if (result.success) {
      toast.success(result.message);
      fetchAppointments();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("refresh-notifications"));
      }
    } else {
      toast.error(result.message);
    }
  };

  const statusVariant = (status) => {
    switch (status) {
      case "SCHEDULED": return "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-400 border-0";
      case "COMPLETED": return "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400 border-0";
      case "CANCELLED": return "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-400 border-0";
      default: return "secondary";
    }
  };

  const columns = [
    {
      accessorKey: "patient",
      header: "Patient",
      cell: ({ row }) => {
        const p = row.original.patient;
        return (
          <div>
            <p className="font-bold text-foreground">{p.firstName} {p.lastName}</p>
            <p className="text-xs font-medium text-muted-foreground mt-0.5">{p.phone || "N/A"}</p>
          </div>
        );
      },
    },
    {
      accessorKey: "doctor",
      header: "Doctor",
      cell: ({ row }) => {
        const d = row.original.doctor;
        return (
          <div>
            <p className="font-bold text-foreground">Dr. {d.user.firstName} {d.user.lastName}</p>
            <p className="text-xs font-medium text-primary mt-0.5">{d.department.name}</p>
          </div>
        );
      },
    },
    {
      accessorKey: "appointmentDate",
      header: "Date",
      cell: ({ row }) => <span className="font-semibold text-muted-foreground">{format(new Date(row.original.appointmentDate), "MMM dd, yyyy")}</span>,
    },
    {
      accessorKey: "appointmentTime",
      header: "Time",
      cell: ({ row }) => <span className="font-bold">{row.original.appointmentTime}</span>
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge className={`px-2.5 py-0.5 font-bold shadow-none ${statusVariant(row.original.status)}`}>{row.original.status}</Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary outline-none">
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-xl shadow-lg p-1">
            <DropdownMenuItem className="font-medium cursor-pointer rounded-lg mb-1" onClick={() => router.push(`/appointments/${row.original.id}`)}>
              <Eye className="mr-2 size-4 text-primary" />
              View Details
            </DropdownMenuItem>
            {row.original.status === "SCHEDULED" && (
              <>
                {!isPatient && (
                  <DropdownMenuItem className="font-medium cursor-pointer rounded-lg mb-1" onClick={() => handleComplete(row.original.id)}>
                    <CheckCircle className="mr-2 size-4 text-emerald-500" />
                    Mark Completed
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem className="font-medium cursor-pointer rounded-lg text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => setCancelId(row.original.id)}>
                  <XCircle className="mr-2 size-4" />
                  Cancel
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="animate-in fade-in zoom-in-95 duration-500">
      <PageHeader
        title="Appointments"
        description="Manage patient appointments and scheduling"
        breadcrumbs={[{ label: "Appointments" }]}
      >
        <Link href="/appointments/new">
          <Button className="gradient-primary h-11 rounded-xl shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 border-0 font-bold px-6">
            <Plus className="mr-2 size-5" />
            Book Appointment
          </Button>
        </Link>
      </PageHeader>

      <div className="bg-card shadow-soft rounded-3xl border border-border/40 p-4 sm:p-6 mb-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search appointments..."
              className="pl-11 h-12 rounded-xl bg-background/50 border-border/60 focus-visible:ring-primary/30 font-medium"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }}>
            <SelectTrigger className="w-[180px] h-12 rounded-xl bg-background/50 border-border/60 font-medium">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="rounded-xl shadow-lg">
              <SelectItem value="all" className="font-medium">All Status</SelectItem>
              <SelectItem value="SCHEDULED" className="font-medium">Scheduled</SelectItem>
              <SelectItem value="COMPLETED" className="font-medium">Completed</SelectItem>
              <SelectItem value="CANCELLED" className="font-medium">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-muted/60" />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border/50 overflow-hidden">
            <DataTable columns={columns} data={appointments} pagination={pagination} onPageChange={setPage} />
          </div>
        )}
      </div>

      <Dialog open={!!cancelId} onOpenChange={() => setCancelId(null)}>
        <DialogContent className="sm:max-w-md sm:rounded-3xl border-border/40 bg-card shadow-2xl p-0 overflow-hidden">
          <div className="bg-red-50/80 dark:bg-red-950/30 p-6 border-b border-red-100/80 dark:border-red-900/30 flex items-start gap-4">
            <div className="bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400 p-3 rounded-2xl shadow-xs">
              <XCircle className="size-6" />
            </div>
            <div className="space-y-1 pr-6">
              <DialogTitle className="text-xl font-extrabold text-foreground tracking-tight">Cancel Appointment</DialogTitle>
              <DialogDescription className="text-sm font-medium text-muted-foreground leading-snug">Are you sure you want to cancel this appointment?</DialogDescription>
            </div>
          </div>
          
          <div className="p-6 bg-slate-50/80 dark:bg-slate-900/40">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 leading-relaxed">
              This action cannot be undone. The schedule will be freed up for other patients.
            </p>
          </div>

          <DialogFooter className="p-5 border-t border-border/40 bg-card flex flex-row items-center justify-end gap-3">
            <Button
              variant="outline"
              className="rounded-full h-11 px-6 font-semibold border-slate-200/80 bg-slate-100/70 hover:bg-slate-200/80 dark:border-slate-800 dark:bg-slate-800/40 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200"
              onClick={() => setCancelId(null)}
            >
              Keep Appointment
            </Button>
            <Button
              variant="destructive"
              className="rounded-full h-11 px-6 font-bold bg-red-100 text-red-600 hover:bg-red-200/80 dark:bg-red-950/60 dark:text-red-400 border border-red-200/80 dark:border-red-900/40 shadow-xs transition-all"
              onClick={handleCancel}
              disabled={cancelling}
            >
              {cancelling ? "Cancelling..." : "Cancel Appointment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}