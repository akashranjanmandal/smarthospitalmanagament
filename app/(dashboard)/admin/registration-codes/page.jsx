"use client";

import { getRoleLabel } from "@/lib/roles";
import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/tables/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FormSelect } from "@/components/shared/form-select";
import {
  generateRegistrationCode,
  getRegistrationCodes,
  revokeRegistrationCode,
  extendRegistrationCode,
} from "@/actions/registration-codes";
import { getAllDepartments } from "@/actions/departments";
import { Plus, MoreHorizontal, Ban, Clock, Copy, Shield, KeyRound, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function RegistrationCodesPage() {
  const [codes, setCodes] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [showGenerate, setShowGenerate] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [generatedCode, setGeneratedCode] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [formData, setFormData] = useState({ role: "DOCTOR", departmentId: "", expiresInDays: 7 });

  const fetchCodes = useCallback(async () => {
    setLoading(true);
    const result = await getRegistrationCodes({ status: statusFilter !== "all" ? statusFilter : undefined, page, limit: 20 });
    if (result.success) { setCodes(result.data); setPagination(result.pagination); }
    else { toast.error(result.message); }
    setLoading(false);
  }, [statusFilter, page]);

  useEffect(() => { fetchCodes(); }, [fetchCodes]);

  useEffect(() => {
    getAllDepartments().then((res) => {
      if (res.success) setDepartments(res.data);
    });
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    const result = await generateRegistrationCode({
      role: formData.role,
      departmentId: formData.departmentId || null,
      expiresInDays: parseInt(formData.expiresInDays) || 7,
    });
    if (result.success) {
      setGeneratedCode(result.data);
      setShowGenerate(false);
      setShowResult(true);
      fetchCodes();
    } else { toast.error(result.message); }
    setGenerating(false);
  };

  const handleRevoke = async (id) => {
    const result = await revokeRegistrationCode(id);
    if (result.success) { toast.success(result.message); fetchCodes(); }
    else { toast.error(result.message); }
  };

  const handleExtend = async (id) => {
    const result = await extendRegistrationCode(id, 7);
    if (result.success) { toast.success(result.message); fetchCodes(); }
    else { toast.error(result.message); }
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    toast.success("Code copied to clipboard");
  };

  const statusVariant = (status) => {
    switch (status) { 
      case "UNUSED": return "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400 border-0"; 
      case "USED": return "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-400 border-0"; 
      case "EXPIRED": return "bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/40 dark:text-orange-400 border-0"; 
      case "REVOKED": return "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-400 border-0"; 
      default: return "secondary"; 
    }
  };

  const columns = [
    { accessorKey: "code", header: "Code", cell: ({ row }) => <div className="flex items-center gap-2"><span className="font-mono font-bold tracking-wider text-primary">{row.original.code}</span><Button variant="ghost" size="icon" className="h-6 w-6 rounded-md hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => copyCode(row.original.code)}><Copy className="size-3.5" /></Button></div> },
    { accessorKey: "role", header: "Role", cell: ({ row }) => <Badge variant="outline" className="font-semibold bg-background">{getRoleLabel(row.original.role)}</Badge> },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <Badge className={`font-semibold shadow-none ${statusVariant(row.original.status)}`}>{row.original.status}</Badge> },
    { accessorKey: "expiresAt", header: "Expires", cell: ({ row }) => <span className="font-medium text-muted-foreground">{format(new Date(row.original.expiresAt), "MMM dd, yyyy")}</span> },
    { accessorKey: "usedBy", header: "Used By", cell: ({ row }) => row.original.usedBy ? <span className="font-medium">{`${row.original.usedBy.firstName} ${row.original.usedBy.lastName}`}</span> : <span className="text-muted-foreground">—</span> },
    { accessorKey: "createdAt", header: "Created", cell: ({ row }) => <span className="text-muted-foreground">{format(new Date(row.original.createdAt), "MMM dd, yyyy")}</span> },
    { id: "actions", header: "", cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary outline-none"><MoreHorizontal className="size-4" /></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="rounded-xl shadow-lg">
          <DropdownMenuItem className="font-medium cursor-pointer" onClick={() => copyCode(row.original.code)}><Copy className="mr-2 size-4 text-muted-foreground" />Copy Code</DropdownMenuItem>
          {row.original.status === "UNUSED" && (<>
            <DropdownMenuItem className="font-medium cursor-pointer" onClick={() => handleExtend(row.original.id)}><Clock className="mr-2 size-4 text-blue-500" />Extend 7 Days</DropdownMenuItem>
            <DropdownMenuItem className="font-medium cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => handleRevoke(row.original.id)}><Ban className="mr-2 size-4" />Revoke</DropdownMenuItem>
          </>)}
        </DropdownMenuContent>
      </DropdownMenu>
    ) },
  ];

  return (
    <div className="animate-in fade-in zoom-in-95 duration-500">
      <PageHeader title="Registration Codes" description="Manage employee registration codes securely" breadcrumbs={[{ label: "Admin" }, { label: "Registration Codes" }]}>
        <Button onClick={() => setShowGenerate(true)} className="gradient-primary h-11 rounded-xl shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 border-0 font-bold px-6">
          <Plus className="mr-2 size-4" /> Generate Code
        </Button>
      </PageHeader>

      <Card className="shadow-soft border-border/40 bg-card rounded-2xl overflow-hidden mb-6">
        <CardContent className="p-4 sm:p-6">
          <div className="mb-6 flex gap-4 w-full max-w-xs">
            <FormSelect 
              options={[{ value: "all", label: "All Status" }, { value: "UNUSED", label: "Unused" }, { value: "USED", label: "Used" }, { value: "EXPIRED", label: "Expired" }, { value: "REVOKED", label: "Revoked" }]} 
              onValueChange={(val) => { setStatusFilter(val); setPage(1); }} 
              placeholder="Filter by status" 
            />
          </div>

          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-muted/60" />)}
            </div>
          ) : (
            <div className="rounded-xl border border-border/50 overflow-hidden">
              <DataTable columns={columns} data={codes} pagination={pagination} onPageChange={setPage} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generate Code Modal */}
      <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
        <DialogContent className="sm:rounded-3xl border-border/50 shadow-2xl p-0 overflow-hidden">
          <div className="bg-muted/30 p-6 border-b border-border/50 flex items-start gap-4">
            <div className="bg-primary/10 p-3 rounded-2xl">
              <KeyRound className="size-6 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">Generate Registration Code</DialogTitle>
              <DialogDescription className="mt-1 font-medium">Create a new secure employee registration code.</DialogDescription>
            </div>
          </div>
          <div className="p-6 space-y-5 bg-background">
            <div className="space-y-2.5">
              <Label className="font-semibold">Role <span className="text-destructive">*</span></Label>
              <FormSelect options={[{ value: "DOCTOR", label: "Doctor" }, { value: "NURSE", label: "Nurse" }, { value: "RECEPTIONIST", label: "Receptionist" }, { value: "WARD_ATTENDANT", label: "Ward Attendant" }, { value: "INSURANCE_DESK", label: "Insurance / TPA Desk" }, { value: "PHARMACIST", label: "Pharmacist" }, { value: "LAB_TECH", label: "Lab / Radiology Technician" }, { value: "KITCHEN", label: "Kitchen / Dietitian" }, { value: "KIOSK", label: "Self-service Kiosk (device)" }, { value: "ADMIN", label: "Administrator" }]} onValueChange={(val) => setFormData({ ...formData, role: val })} placeholder="Select role" />
            </div>
            <div className="space-y-2.5">
              <Label className="font-semibold">Department <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <FormSelect options={[{ value: "", label: "None" }, ...departments.map((d) => ({ value: d.id, label: d.name }))]} onValueChange={(val) => setFormData({ ...formData, departmentId: val })} placeholder="Select department" />
            </div>
            <div className="space-y-2.5">
              <Label htmlFor="expiresInDays" className="font-semibold">Expires In (days)</Label>
              <Input id="expiresInDays" type="number" min="1" max="90" value={formData.expiresInDays} onChange={(e) => setFormData({ ...formData, expiresInDays: e.target.value })} className="h-11 rounded-xl bg-background/50 focus-visible:ring-primary/30" />
            </div>
          </div>
          <DialogFooter className="p-6 border-t border-border/50 bg-muted/10">
            <Button variant="outline" className="rounded-xl h-11 font-semibold" onClick={() => setShowGenerate(false)}>Cancel</Button>
            <Button onClick={handleGenerate} disabled={generating} className="gradient-primary border-0 rounded-xl h-11 shadow-md hover:shadow-lg transition-all font-bold">
              {generating ? "Generating..." : "Generate Secure Code"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Modal */}
      <Dialog open={showResult} onOpenChange={setShowResult}>
        <DialogContent className="sm:rounded-3xl border-border/50 shadow-2xl p-8 text-center max-w-sm">
          <div className="mx-auto bg-emerald-100 dark:bg-emerald-900/30 w-16 h-16 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 className="size-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <DialogHeader className="text-center">
            <DialogTitle className="text-2xl font-extrabold tracking-tight">Code Generated!</DialogTitle>
            <DialogDescription className="font-medium mt-2">Share this code securely. It can only be used once.</DialogDescription>
          </DialogHeader>
          
          {generatedCode && (
            <div className="space-y-6 mt-6">
              <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-6 relative group overflow-hidden">
                <p className="text-3xl font-mono font-bold tracking-widest text-primary relative z-10">{generatedCode.code}</p>
                <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm bg-muted/50 rounded-2xl p-4">
                <div className="text-left">
                  <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-1">Role</p>
                  <p className="font-bold text-foreground">{getRoleLabel(generatedCode.role)}</p>
                </div>
                <div className="text-left border-l pl-4">
                  <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-1">Expires</p>
                  <p className="font-bold text-foreground">{format(new Date(generatedCode.expiresAt), "MMM dd")}</p>
                </div>
              </div>
              
              <Button className="w-full h-12 rounded-xl gradient-accent border-0 shadow-md font-bold text-base hover:-translate-y-0.5 transition-all" onClick={() => { copyCode(generatedCode.code); setShowResult(false); }}>
                <Copy className="mr-2 size-5" /> Copy & Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}