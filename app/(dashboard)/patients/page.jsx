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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getPatients, deletePatient } from "@/actions/patients";
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Eye, UserRound } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function PatientsPage() {
  const router = useRouter();

  const [patients, setPatients] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    const result = await getPatients({
      search: search || undefined,
      gender: genderFilter !== "all" ? genderFilter : undefined,
      page,
      limit: 10,
    });

    if (result.success) {
      setPatients(result.data);
      setPagination(result.pagination);
    } else {
      toast.error(result.message);
    }
    setLoading(false);
  }, [search, genderFilter, page]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    const result = await deletePatient(deleteId);
    if (result.success) {
      toast.success(result.message);
      fetchPatients();
    } else {
      toast.error(result.message);
    }
    setDeleting(false);
    setDeleteId(null);
  };

  const getInitials = (first, last) => `${first?.[0] || ""}${last?.[0] || ""}`.toUpperCase();

  const columns = [
    {
      accessorKey: "name",
      header: "Patient Profile",
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="flex items-center gap-4 py-1">
            <Avatar className="size-11 border-2 border-background shadow-sm">
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                {getInitials(p.firstName, p.lastName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-bold text-foreground text-base hover:text-primary transition-colors cursor-pointer" onClick={() => router.push(`/patients/${p.id}`)}>
                {p.firstName} {p.lastName}
              </p>
              <p className="text-xs font-medium text-muted-foreground mt-0.5 truncate max-w-[180px] tabular-nums">{p.uhid}{p.user?.email && !p.user.email.endsWith("@phone.local") ? ` · ${p.user.email}` : ""}</p>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "gender",
      header: "Gender",
      cell: ({ row }) => (
        <Badge variant="outline" className="font-semibold bg-background shadow-sm px-2.5 py-0.5">
          {row.original.gender}
        </Badge>
      ),
    },
    {
      accessorKey: "dateOfBirth",
      header: "Date of Birth",
      cell: ({ row }) => (
        <span className="font-semibold text-muted-foreground">
          {format(new Date(row.original.dateOfBirth), "MMM dd, yyyy")}
        </span>
      ),
    },
    {
      accessorKey: "phone",
      header: "Phone",
      cell: ({ row }) => (
        <span className="font-medium text-foreground/80">{row.original.phone || "—"}</span>
      ),
    },
    {
      accessorKey: "bloodGroup",
      header: "Blood Grp",
      cell: ({ row }) => (
        <Badge className={`px-2.5 py-0.5 font-bold shadow-none border-0 ${
          row.original.bloodGroup ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400" : "bg-muted text-muted-foreground"
        }`}>
          {row.original.bloodGroup || "—"}
        </Badge>
      ),
    },
    {
      accessorKey: "_count.appointments",
      header: "Visits",
      cell: ({ row }) => (
        <Badge className="font-bold bg-primary/10 text-primary hover:bg-primary/20 shadow-none border-0 px-2.5 py-0.5">
          {row.original._count.appointments}
        </Badge>
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
            <DropdownMenuItem className="font-medium cursor-pointer rounded-lg mb-1" onClick={() => router.push(`/patients/${row.original.id}`)}>
              <Eye className="mr-2 size-4 text-primary" /> View Profile
            </DropdownMenuItem>
            <DropdownMenuItem className="font-medium cursor-pointer rounded-lg mb-1" onClick={() => router.push(`/patients/${row.original.id}/edit`)}>
              <Pencil className="mr-2 size-4 text-muted-foreground" /> Edit Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDeleteId(row.original.id)} className="font-medium cursor-pointer rounded-lg text-destructive focus:text-destructive focus:bg-destructive/10">
              <Trash2 className="mr-2 size-4" /> Archive Patient
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="animate-in fade-in zoom-in-95 duration-500">
      <PageHeader
        title="Patients"
        description="Manage patient records, demographics, and clinical histories"
        breadcrumbs={[{ label: "Patients" }]}
      >
        <Link href="/patients/new">
          <Button className="gradient-primary h-11 rounded-xl shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 border-0 font-bold px-6">
            <Plus className="mr-2 size-5" />
            Register Patient
          </Button>
        </Link>
      </PageHeader>

      <div className="bg-card shadow-soft rounded-3xl border border-border/40 p-4 sm:p-6 mb-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, UHID or phone"
              className="pl-11 h-12 rounded-xl bg-background/50 border-border/60 focus-visible:ring-primary/30 font-medium"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <Select value={genderFilter} onValueChange={(val) => { setGenderFilter(val); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-[160px] h-12 rounded-xl bg-background/50 border-border/60 font-medium">
              <SelectValue placeholder="Gender" />
            </SelectTrigger>
            <SelectContent className="rounded-xl shadow-lg">
              <SelectItem value="all" className="font-medium">All Genders</SelectItem>
              <SelectItem value="MALE" className="font-medium">Male</SelectItem>
              <SelectItem value="FEMALE" className="font-medium">Female</SelectItem>
              <SelectItem value="OTHER" className="font-medium">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-muted/60" />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border/50 overflow-hidden">
            <DataTable columns={columns} data={patients} pagination={pagination} onPageChange={setPage} />
          </div>
        )}
      </div>

      {/* Delete/Archive Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="sm:rounded-3xl border-border/50 shadow-2xl p-0 overflow-hidden">
          <div className="bg-red-50/50 dark:bg-red-900/10 p-6 border-b border-border/50 flex items-start gap-4">
            <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-2xl">
              <Trash2 className="size-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">Archive Patient</DialogTitle>
              <DialogDescription className="mt-1 font-medium">
                Are you sure you want to archive this patient record?
              </DialogDescription>
            </div>
          </div>
          <div className="p-6 bg-background">
            <p className="text-sm font-medium text-muted-foreground">
              This action will hide the patient from active lists. Data associated with appointments and billing will be preserved for hospital records.
            </p>
          </div>
          <DialogFooter className="p-6 border-t border-border/50 bg-muted/10">
            <Button variant="outline" className="rounded-xl h-11 font-semibold" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" className="rounded-xl h-11 font-bold shadow-md hover:shadow-lg transition-all" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Archiving..." : "Archive Patient"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}