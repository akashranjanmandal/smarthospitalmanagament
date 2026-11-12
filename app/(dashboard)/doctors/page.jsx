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
import { getDoctors, deleteDoctor } from "@/actions/doctors";
import { getAllDepartments } from "@/actions/departments";
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Eye, UserCog } from "lucide-react";
import { toast } from "sonner";

export default function DoctorsPage() {
  const router = useRouter();

  const [doctors, setDoctors] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [availableFilter, setAvailableFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    getAllDepartments().then((res) => {
      if (res.success) setDepartments(res.data);
    });
  }, []);

  const fetchDoctors = useCallback(async () => {
    setLoading(true);
    const result = await getDoctors({
      search: search || undefined,
      departmentId: departmentFilter !== "all" ? departmentFilter : undefined,
      available: availableFilter !== "all" ? availableFilter : undefined,
      page,
      limit: 10,
    });

    if (result.success) {
      setDoctors(result.data);
      setPagination(result.pagination);
    } else {
      toast.error(result.message);
    }
    setLoading(false);
  }, [search, departmentFilter, availableFilter, page]);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    const result = await deleteDoctor(deleteId);
    if (result.success) {
      toast.success(result.message);
      fetchDoctors();
    } else {
      toast.error(result.message);
    }
    setDeleting(false);
    setDeleteId(null);
  };

  const getInitials = (firstName, lastName) => {
    return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
  };

  const columns = [
    {
      accessorKey: "name",
      header: "Doctor Profile",
      cell: ({ row }) => {
        const d = row.original;
        return (
          <div className="flex items-center gap-4 py-1">
            <Avatar className="size-11 border-2 border-background shadow-sm">
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                {getInitials(d.user.firstName, d.user.lastName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-bold text-foreground text-base hover:text-primary transition-colors cursor-pointer" onClick={() => router.push(`/doctors/${d.id}`)}>
                Dr. {d.user.firstName} {d.user.lastName}
              </p>
              <p className="text-xs font-medium text-muted-foreground mt-0.5">{d.user.email}</p>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "department.name",
      header: "Department",
      cell: ({ row }) => (
        <Badge variant="outline" className="font-semibold bg-background shadow-sm px-2.5 py-0.5">
          {row.original.department.name}
        </Badge>
      ),
    },
    {
      accessorKey: "specialization",
      header: "Specialty",
      cell: ({ row }) => (
        <span className="font-medium text-foreground/80">{row.original.specialization}</span>
      ),
    },
    {
      accessorKey: "experience",
      header: "Exp.",
      cell: ({ row }) => (
        <span className="font-semibold">{row.original.experience} <span className="text-muted-foreground text-xs font-medium">yrs</span></span>
      ),
    },
    {
      accessorKey: "available",
      header: "Status",
      cell: ({ row }) => (
        <Badge className={`px-2.5 py-0.5 font-bold shadow-none border-0 ${
          row.original.available 
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" 
            : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
        }`}>
          {row.original.available ? "Available" : "Unavailable"}
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
            <DropdownMenuItem className="font-medium cursor-pointer rounded-lg mb-1" onClick={() => router.push(`/doctors/${row.original.id}`)}>
              <Eye className="mr-2 size-4 text-primary" />
              View Profile
            </DropdownMenuItem>
            <DropdownMenuItem className="font-medium cursor-pointer rounded-lg mb-1" onClick={() => router.push(`/doctors/${row.original.id}/edit`)}>
              <Pencil className="mr-2 size-4 text-muted-foreground" />
              Edit Details
            </DropdownMenuItem>
            <DropdownMenuItem className="font-medium cursor-pointer rounded-lg text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => setDeleteId(row.original.id)}>
              <Trash2 className="mr-2 size-4" />
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="animate-in fade-in zoom-in-95 duration-500">
      <PageHeader
        title="Doctors"
        description="Manage hospital doctors, specialties, and schedule availability"
        breadcrumbs={[{ label: "Doctors" }]}
      >
        <Link href="/doctors/new">
          <Button className="gradient-primary h-11 rounded-xl shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 border-0 font-bold px-6">
            <Plus className="mr-2 size-5" />
            Add Doctor
          </Button>
        </Link>
      </PageHeader>

      <div className="bg-card shadow-soft rounded-3xl border border-border/40 p-4 sm:p-6 mb-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search doctors by name or email..."
              className="pl-11 h-12 rounded-xl bg-background/50 border-border/60 focus-visible:ring-primary/30 font-medium"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <div className="flex gap-4">
            <Select value={departmentFilter} onValueChange={(val) => { setDepartmentFilter(val); setPage(1); }}>
              <SelectTrigger className="w-auto min-w-[160px] sm:min-w-[180px] h-12 rounded-xl bg-background/50 border-border/60 font-medium">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent className="rounded-xl shadow-lg">
                <SelectItem value="all" className="font-medium">All Departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id} className="font-medium">{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={availableFilter} onValueChange={(val) => { setAvailableFilter(val); setPage(1); }}>
              <SelectTrigger className="w-auto min-w-[130px] sm:min-w-[160px] h-12 rounded-xl bg-background/50 border-border/60 font-medium">
                <SelectValue placeholder="Availability" />
              </SelectTrigger>
              <SelectContent className="rounded-xl shadow-lg">
                <SelectItem value="all" className="font-medium">All Status</SelectItem>
                <SelectItem value="true" className="font-medium text-emerald-600 focus:text-emerald-700">Available</SelectItem>
                <SelectItem value="false" className="font-medium">Unavailable</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-muted/60" />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border/50 overflow-hidden">
            <DataTable columns={columns} data={doctors} pagination={pagination} onPageChange={setPage} />
          </div>
        )}
      </div>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="sm:rounded-3xl border-border/50 shadow-2xl p-0 overflow-hidden">
          <div className="bg-red-50/50 dark:bg-red-900/10 p-6 border-b border-border/50 flex items-start gap-4">
            <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-2xl">
              <Trash2 className="size-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">Remove Doctor</DialogTitle>
              <DialogDescription className="mt-1 font-medium">
                Are you sure you want to remove this doctor from the system?
              </DialogDescription>
            </div>
          </div>
          <div className="p-6 bg-background">
            <p className="text-sm font-medium text-muted-foreground">
              This action cannot be undone. Associated records and past appointments will be preserved, but the account access will be revoked.
            </p>
          </div>
          <DialogFooter className="p-6 border-t border-border/50 bg-muted/10">
            <Button variant="outline" className="rounded-xl h-11 font-semibold" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" className="rounded-xl h-11 font-bold shadow-md hover:shadow-lg transition-all" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Removing..." : "Remove Doctor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}