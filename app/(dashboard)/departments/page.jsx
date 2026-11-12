"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { getDepartments, deleteDepartment } from "@/actions/departments";
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Building2 } from "lucide-react";
import { toast } from "sonner";

export default function DepartmentsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [departments, setDepartments] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "all");
  const [page, setPage] = useState(parseInt(searchParams.get("page") || "1"));
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchDepartments = useCallback(async () => {
    setLoading(true);
    const result = await getDepartments({
      search: search || undefined,
      status: status !== "all" ? status : undefined,
      page,
      limit: 10,
    });

    if (result.success) {
      setDepartments(result.data);
      setPagination(result.pagination);
    } else {
      toast.error(result.message);
    }
    setLoading(false);
  }, [search, status, page]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    const result = await deleteDepartment(deleteId);
    if (result.success) {
      toast.success(result.message);
      fetchDepartments();
    } else {
      toast.error(result.message);
    }
    setDeleting(false);
    setDeleteId(null);
  };

  const columns = [
    {
      accessorKey: "name",
      header: "Department Name",
      cell: ({ row }) => (
        <div className="font-bold text-foreground text-base flex items-center gap-2">
          <Building2 className="size-4 text-primary opacity-70" />
          {row.original.name}
        </div>
      ),
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => (
        <div className="max-w-[300px] xl:max-w-[500px] truncate font-medium text-muted-foreground">
          {row.original.description || "—"}
        </div>
      ),
    },
    {
      accessorKey: "_count.doctors",
      header: "Doctors",
      cell: ({ row }) => (
        <Badge variant="outline" className="font-bold px-2 py-0.5 bg-background shadow-sm">
          {row.original._count.doctors}
        </Badge>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge className={`px-3 py-1 font-bold shadow-none ${
          row.original.status === "ACTIVE"
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 hover:bg-emerald-100 border-0"
            : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 hover:bg-amber-100 border-0"
        }`}>
          {row.original.status}
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
          <DropdownMenuContent align="end" className="rounded-xl shadow-lg p-1">
            <DropdownMenuItem className="font-medium cursor-pointer rounded-lg mb-1" onClick={() => router.push(`/departments/${row.original.id}`)}>
              <Building2 className="mr-2 size-4 text-primary" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem className="font-medium cursor-pointer rounded-lg mb-1" onClick={() => router.push(`/departments/${row.original.id}/edit`)}>
              <Pencil className="mr-2 size-4 text-muted-foreground" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setDeleteId(row.original.id)}
              className="font-medium cursor-pointer rounded-lg text-destructive focus:text-destructive focus:bg-destructive/10"
            >
              <Trash2 className="mr-2 size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="animate-in fade-in zoom-in-95 duration-500">
      <PageHeader
        title="Departments"
        description="Manage hospital departments and organize your medical staff"
        breadcrumbs={[{ label: "Departments" }]}
      >
        <Link href="/departments/new">
          <Button className="gradient-primary h-11 rounded-xl shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 border-0 font-bold px-6">
            <Plus className="mr-2 size-5" />
            Add Department
          </Button>
        </Link>
      </PageHeader>

      <div className="bg-card shadow-soft rounded-3xl border border-border/40 p-4 sm:p-6 mb-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search departments..."
              className="pl-11 h-12 rounded-xl bg-background/50 border-border/60 focus-visible:ring-primary/30 font-medium"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select value={status} onValueChange={(val) => { setStatus(val); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-[180px] h-12 rounded-xl bg-background/50 border-border/60 font-medium">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent className="rounded-xl shadow-lg">
              <SelectItem value="all" className="font-medium">All Status</SelectItem>
              <SelectItem value="ACTIVE" className="font-medium">Active</SelectItem>
              <SelectItem value="INACTIVE" className="font-medium">Inactive</SelectItem>
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
            <DataTable
              columns={columns}
              data={departments}
              pagination={pagination}
              onPageChange={setPage}
            />
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
              <DialogTitle className="text-xl font-bold">Delete Department</DialogTitle>
              <DialogDescription className="mt-1 font-medium">
                Are you sure you want to delete this department?
              </DialogDescription>
            </div>
          </div>
          <div className="p-6 bg-background">
            <p className="text-sm font-medium text-muted-foreground">
              This action cannot be undone. Make sure no doctors are actively assigned to this department before deleting.
            </p>
          </div>
          <DialogFooter className="p-6 border-t border-border/50 bg-muted/10">
            <Button variant="outline" className="rounded-xl h-11 font-semibold" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" className="rounded-xl h-11 font-bold shadow-md hover:shadow-lg transition-all" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete Department"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}