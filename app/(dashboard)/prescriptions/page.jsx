"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/tables/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Chip } from "@/components/inpatient/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getPrescriptions } from "@/actions/prescriptions";
import { useRole } from "@/hooks/use-role";
import { Plus, Search, MoreHorizontal, Eye, Pill, UserRound, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function PrescriptionsPage() {
  const router = useRouter();
  const { isPatient, role } = useRole();
  const [prescriptions, setPrescriptions] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const fetchPrescriptions = useCallback(async () => {
    setLoading(true);
    const result = await getPrescriptions({ search: search || undefined, page, limit: 10 });
    if (result.success) { setPrescriptions(result.data); setPagination(result.pagination); }
    else { toast.error(result.message); }
    setLoading(false);
  }, [search, page]);

  useEffect(() => { fetchPrescriptions(); }, [fetchPrescriptions]);

  const canCreate = !isPatient && (role === "DOCTOR" || role === "ADMIN" || role === "SUPER_ADMIN");

  const columns = [
    {
      accessorKey: "patient",
      header: "Patient",
      cell: ({ row }) => {
        const p = row.original.medicalRecord?.patient;
        return p ? (
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex p-2 bg-primary/10 rounded-lg text-primary">
              <UserRound className="size-4" />
            </div>
            <p className="font-bold text-foreground text-base hover:text-primary transition-colors cursor-pointer" onClick={() => router.push(`/prescriptions/${row.original.id}`)}>
              {p.firstName} {p.lastName}
            </p>
          </div>
        ) : <span className="text-muted-foreground">—</span>;
      },
    },
    {
      accessorKey: "doctor",
      header: "Prescribed By",
      cell: ({ row }) => (
        <p className="font-bold text-foreground">Dr. {row.original.doctor.user.firstName} {row.original.doctor.user.lastName}</p>
      ),
    },
    {
      accessorKey: "items",
      header: "Medicines",
      cell: ({ row }) => (
        <Badge className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400 font-bold shadow-none border-0 px-2.5 py-0.5">
          {row.original.items.length} item(s)
        </Badge>
      ),
    },
    {
      id: "pharmacy",
      header: "Pharmacy",
      cell: ({ row }) => {
        const o = row.original.pharmacyOrder;
        if (!o) return <span className="text-xs text-muted-foreground">—</span>;
        const label = { RECEIVED: "Sent to pharmacy", PREPARING: "Being prepared", READY: "Ready for pickup", DISPENSED: "Collected", CANCELLED: "Cancelled" }[o.status];
        const tone = { READY: "good", DISPENSED: "neutral", CANCELLED: "bad" }[o.status] ?? "info";
        return <span title={o.orderNumber}><Chip tone={tone}>{label}</Chip></span>;
      },
    },
    {
      accessorKey: "medicines",
      header: "Medicine Names",
      cell: ({ row }) => (
        <span className="text-muted-foreground font-medium text-sm line-clamp-1 max-w-[200px] xl:max-w-[300px]">
          {row.original.items.map(i => i.medicineName).join(", ")}
        </span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: "Date Issued",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 text-muted-foreground font-semibold">
          <CalendarClock className="size-3.5" />
          {format(new Date(row.original.createdAt), "MMM dd, yyyy")}
        </div>
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
          <DropdownMenuContent align="end" className="rounded-xl shadow-lg p-1 min-w-[160px]">
            <DropdownMenuItem className="font-medium cursor-pointer rounded-lg" onClick={() => router.push(`/prescriptions/${row.original.id}`)}>
              <Eye className="mr-2 size-4 text-primary" /> View Details
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="animate-in fade-in zoom-in-95 duration-500">
      <PageHeader 
        title="Prescriptions" 
        description="View and manage patient medication records and clinical instructions" 
        breadcrumbs={[{ label: "Prescriptions" }]} 
      >
        {canCreate && (
          <Link href="/prescriptions/new">
            <Button className="gradient-primary h-11 rounded-xl shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 border-0 font-bold px-6">
              <Plus className="mr-2 size-5" />
              Create Prescription
            </Button>
          </Link>
        )}
      </PageHeader>
      
      <div className="bg-card shadow-soft rounded-3xl border border-border/40 p-4 sm:p-6 mb-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Search prescriptions by patient..." 
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
            <DataTable columns={columns} data={prescriptions} pagination={pagination} onPageChange={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}