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
import { getBills, markBillPaid } from "@/actions/billing";
import { useRole } from "@/hooks/use-role";
import { FormSelect } from "@/components/shared/form-select";
import { Plus, Search, MoreHorizontal, Eye, CheckCircle, ReceiptText } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function BillingPage() {
  const router = useRouter();
  const { isPatient, role } = useRole();
  const [bills, setBills] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  const fetchBills = useCallback(async () => {
    setLoading(true);
    const result = await getBills({ search: search || undefined, paymentStatus: statusFilter !== "all" ? statusFilter : undefined, page, limit: 10 });
    if (result.success) { setBills(result.data); setPagination(result.pagination); }
    else { toast.error(result.message); }
    setLoading(false);
  }, [search, statusFilter, page]);

  useEffect(() => { fetchBills(); }, [fetchBills]);

  const handleMarkPaid = async (id) => {
    const result = await markBillPaid(id, "CASH");
    if (result.success) {
      toast.success(result.message);
      fetchBills();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("refresh-notifications"));
      }
    } else {
      toast.error(result.message);
    }
  };

  const canCreate = !isPatient && (role === "ADMIN" || role === "SUPER_ADMIN" || role === "RECEPTIONIST");

  const columns = [
    {
      accessorKey: "patient",
      header: "Patient",
      cell: ({ row }) => (
        <div>
          <p className="font-bold text-foreground">{row.original.patient.firstName} {row.original.patient.lastName}</p>
          <p className="text-xs font-medium text-muted-foreground mt-0.5">INV-{(row.original.id).slice(0,6).toUpperCase()}</p>
        </div>
      )
    },
    {
      accessorKey: "doctor",
      header: "Doctor",
      cell: ({ row }) => {
        const d = row.original.appointment?.doctor;
        return d ? <p className="font-medium text-muted-foreground">Dr. {d.user.firstName} {d.user.lastName}</p> : <span className="text-muted-foreground">—</span>;
      },
    },
    {
      accessorKey: "totalAmount",
      header: "Amount",
      cell: ({ row }) => <p className="font-extrabold text-foreground">₹{row.original.totalAmount.toFixed(2)}</p>,
    },
    {
      accessorKey: "paymentStatus",
      header: "Status",
      cell: ({ row }) => (
        <Badge className={`px-2.5 py-0.5 font-bold shadow-none ${
          row.original.paymentStatus === "PAID" 
            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400 border-0" 
            : "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-400 border-0"
        }`}>
          {row.original.paymentStatus}
        </Badge>
      ),
    },
    {
      accessorKey: "paymentMethod",
      header: "Method",
      cell: ({ row }) => <span className="font-medium">{row.original.paymentMethod || "—"}</span>,
    },
    {
      accessorKey: "createdAt",
      header: "Date",
      cell: ({ row }) => <span className="font-semibold text-muted-foreground">{format(new Date(row.original.createdAt), "MMM dd, yyyy")}</span>,
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
            <DropdownMenuItem className="font-medium cursor-pointer rounded-lg mb-1" onClick={() => router.push(`/billing/${row.original.id}`)}>
              <ReceiptText className="mr-2 size-4 text-primary" /> View Invoice
            </DropdownMenuItem>
            {!isPatient && row.original.paymentStatus === "PENDING" && (
              <DropdownMenuItem className="font-medium cursor-pointer rounded-lg text-emerald-600 focus:text-emerald-700 focus:bg-emerald-50 dark:focus:bg-emerald-900/30" onClick={() => handleMarkPaid(row.original.id)}>
                <CheckCircle className="mr-2 size-4" /> Mark as Paid
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="animate-in fade-in zoom-in-95 duration-500">
      <PageHeader title="Billing & Invoices" description="Manage patient invoices and process payments" breadcrumbs={[{ label: "Billing" }]}>
        {canCreate && (
          <Link href="/billing/new">
            <Button className="gradient-primary h-11 rounded-xl shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 border-0 font-bold px-6">
              <Plus className="mr-2 size-5" /> Generate Bill
            </Button>
          </Link>
        )}
      </PageHeader>

      <div className="bg-card shadow-soft rounded-3xl border border-border/40 p-4 sm:p-6 mb-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Search invoices by patient name..." 
              className="pl-11 h-12 rounded-xl bg-background/50 border-border/60 focus-visible:ring-primary/30 font-medium" 
              value={search} 
              onChange={(e) => { setSearch(e.target.value); setPage(1); }} 
            />
          </div>
          <div className="w-full sm:w-[180px]">
            <FormSelect
              options={[{ value: "all", label: "All Status" }, { value: "PENDING", label: "Pending" }, { value: "PAID", label: "Paid" }]}
              onValueChange={(val) => { setStatusFilter(val); setPage(1); }}
              placeholder="Filter by status"
            />
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted/60" />)}
          </div>
        ) : (
          <div className="rounded-xl border border-border/50 overflow-hidden">
            <DataTable columns={columns} data={bills} pagination={pagination} onPageChange={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}