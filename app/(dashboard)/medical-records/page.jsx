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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getMedicalRecords } from "@/actions/medical-records";
import { useRole } from "@/hooks/use-role";
import { Plus, Search, MoreHorizontal, Eye, FileText, Pill, CalendarClock, UserRound } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function MedicalRecordsPage() {
  const router = useRouter();
  const { isPatient, role } = useRole();
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    const result = await getMedicalRecords({ search: search || undefined, page, limit: 10 });
    if (result.success) {
      setRecords(result.data);
      setPagination(result.pagination);
    } else {
      toast.error(result.message);
    }
    setLoading(false);
  }, [search, page]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const canCreate = !isPatient && (role === "DOCTOR" || role === "ADMIN" || role === "SUPER_ADMIN");

  const columns = [
    {
      accessorKey: "patient",
      header: "Patient",
      cell: ({ row }) => {
        const p = row.original.patient;
        return (
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex p-2 bg-primary/10 rounded-lg text-primary">
              <UserRound className="size-4" />
            </div>
            <p className="font-bold text-foreground text-base hover:text-primary transition-colors cursor-pointer" onClick={() => router.push(`/medical-records/${row.original.id}`)}>
              {p.firstName} {p.lastName}
            </p>
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
            <p className="text-xs font-semibold text-primary mt-0.5">{d.department.name}</p>
          </div>
        );
      },
    },
    {
      accessorKey: "diagnosis",
      header: "Diagnosis",
      cell: ({ row }) => (
        <span className="font-medium text-foreground/80 line-clamp-1 max-w-[200px] xl:max-w-[350px]">
          {row.original.diagnosis || "—"}
        </span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Date",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 text-muted-foreground font-semibold">
          <CalendarClock className="size-3.5" />
          {format(new Date(row.original.createdAt), "MMM dd, yyyy")}
        </div>
      ),
    },
    {
      accessorKey: "prescriptions",
      header: "Prescriptions",
      cell: ({ row }) => {
        const count = row.original.prescriptions.length;
        return (
          <Badge className={`px-2.5 py-0.5 font-bold shadow-none border-0 ${
            count > 0 
              ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400" 
              : "bg-muted text-muted-foreground"
          }`}>
            {count} {count === 1 ? 'Script' : 'Scripts'}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary outline-none">
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-xl shadow-lg p-1 min-w-[160px]">
            <DropdownMenuItem className="font-medium cursor-pointer rounded-lg mb-1" onClick={() => router.push(`/medical-records/${row.original.id}`)}>
              <Eye className="mr-2 size-4 text-primary" /> View Details
            </DropdownMenuItem>
            {!isPatient && (
              <>
                <DropdownMenuItem className="font-medium cursor-pointer rounded-lg mb-1" onClick={() => router.push(`/medical-records/${row.original.id}/edit`)}>
                  <FileText className="mr-2 size-4 text-muted-foreground" /> Edit Record
                </DropdownMenuItem>
                <DropdownMenuItem className="font-medium cursor-pointer rounded-lg text-indigo-600 focus:text-indigo-700 focus:bg-indigo-50 dark:focus:bg-indigo-900/30" onClick={() => router.push(`/prescriptions/new?medicalRecordId=${row.original.id}`)}>
                  <Pill className="mr-2 size-4" /> Add Prescription
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
        title="Medical Records"
        description="View and manage patient clinical histories, diagnoses, and treatments"
        breadcrumbs={[{ label: "Medical Records" }]}
      >
        {canCreate && (
          <Link href="/medical-records/new">
            <Button className="gradient-primary h-11 rounded-xl shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 border-0 font-bold px-6">
              <Plus className="mr-2 size-5" />
              Create Record
            </Button>
          </Link>
        )}
      </PageHeader>

      <div className="bg-card shadow-soft rounded-3xl border border-border/40 p-4 sm:p-6 mb-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Search by patient name or ID..." 
              className="pl-11 h-12 rounded-xl bg-background/50 border-border/60 focus-visible:ring-primary/30 font-medium" 
              value={search} 
              onChange={(e) => { setSearch(e.target.value); setPage(1); }} 
            />
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-muted/60" />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border/50 overflow-hidden">
            <DataTable columns={columns} data={records} pagination={pagination} onPageChange={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}