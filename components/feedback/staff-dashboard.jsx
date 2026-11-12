"use client";

import { useState, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  COMPLAINT_CATEGORY_LABELS,
  COMPLAINT_SEVERITY_LABELS,
  COMPLAINT_STATUS_LABELS,
  ESCALATION_LEVEL_LABELS,
} from "@/lib/constants";
import {
  getFeedbackDashboardData,
  runEscalationBatch,
  seedFeedbackDemoData,
} from "@/actions/feedback";
import { ResolveDialog } from "./resolve-dialog";
import { toast } from "sonner";
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  RefreshCw,
  Search,
  Eye,
  ShieldAlert,
  Play,
  Sparkles,
  Loader2,
  Building2,
} from "lucide-react";

const severityBadges = {
  CRITICAL: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300",
  HIGH: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300",
  MEDIUM: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300",
  LOW: "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300",
};

const statusBadges = {
  SUBMITTED: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300",
  ASSIGNED: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300",
  UNDER_INVESTIGATION: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300",
  RESOLVED: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300",
  REJECTED: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300",
  CLOSED: "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300",
};

const escalationBadges = {
  LEVEL_1_DEPT_HEAD: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300",
  LEVEL_2_ADMIN: "bg-amber-500 text-white font-bold animate-pulse",
  LEVEL_3_DIRECTOR: "bg-rose-600 text-white font-black animate-pulse",
};

export function StaffFeedbackDashboard({ initialData, userRole }) {
  const [data, setData] = useState(initialData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRunningEscalation, setIsRunningEscalation] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  // Active dialog
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");

  const refreshData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await getFeedbackDashboardData({
        search,
        status: statusFilter,
        severity: severityFilter,
        departmentId: deptFilter,
        escalationLevel: levelFilter,
      });
      if (res.success) {
        setData(res.data);
      }
    } catch (err) {
      console.error("Failed to refresh feedback:", err);
      toast.error("Failed to refresh feedback");
    } finally {
      setIsRefreshing(false);
    }
  }, [search, statusFilter, severityFilter, deptFilter, levelFilter]);

  // Auto-refresh when any filter or search term changes
  useEffect(() => {
    const timer = setTimeout(() => {
      refreshData();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, statusFilter, severityFilter, deptFilter, levelFilter, refreshData]);

  const handleRunEscalation = async () => {
    setIsRunningEscalation(true);
    try {
      const res = await runEscalationBatch();
      if (res.success) {
        toast.info(res.message);
        refreshData();
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      console.error("Escalation run error:", err);
      toast.error("Failed to execute escalation batch");
    } finally {
      setIsRunningEscalation(false);
    }
  };

  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      const res = await seedFeedbackDemoData();
      if (res.success) {
        toast.success(res.message);
        refreshData();
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      console.error("Seed error:", err);
      toast.error("Failed to seed demo data");
    } finally {
      setIsSeeding(false);
    }
  };

  const complaints = data?.complaints || [];
  const stats = data?.stats || { total: 0, active: 0, resolved: 0, overdue: 0, level2: 0, level3: 0 };
  const departments = data?.departments || [];

  const now = new Date();

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-primary" />
            Patient Grievance & Escalation Center
          </h1>
          <p className="text-sm text-muted-foreground">
            Automated SLA state machine and accountability tracking across hospital departments
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Manual Escalation Runner */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRunEscalation}
            disabled={isRunningEscalation}
            className="h-9 gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/40"
            title="Evaluate timer rules across all unresolved complaints"
          >
            {isRunningEscalation ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5 text-amber-600 fill-amber-600" />
            )}
            <span>Evaluate SLA Timers</span>
          </Button>

          {/* Demo Seeder */}
          {(userRole === "ADMIN" || userRole === "SUPER_ADMIN") && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSeed}
              disabled={isSeeding}
              className="h-9 gap-1.5 border-dashed border-primary/50 text-primary hover:bg-primary/5"
            >
              {isSeeding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              <span>Seed Demo Tickets</span>
            </Button>
          )}

          {/* Refresh */}
          <Button
            variant="outline"
            size="sm"
            onClick={refreshData}
            disabled={isRefreshing}
            className="h-9 gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card className="border-0 shadow-soft bg-card">
          <CardContent className="p-4 space-y-1">
            <span className="text-sm text-muted-foreground font-semibold uppercase tracking-wider block">Total Logged</span>
            <div className="text-3xl font-bold text-foreground">{stats.total}</div>
            <p className="text-sm text-muted-foreground">All-time hospital tickets</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-soft bg-blue-50/50 dark:bg-blue-950/30">
          <CardContent className="p-4 space-y-1">
            <span className="text-sm text-blue-700 dark:text-blue-300 font-semibold uppercase tracking-wider block">In Progress</span>
            <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">{stats.active}</div>
            <p className="text-sm text-blue-600/80">Active investigation</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-soft bg-rose-50/60 dark:bg-rose-950/40">
          <CardContent className="p-4 space-y-1">
            <span className="text-sm text-rose-700 dark:text-rose-300 font-semibold uppercase tracking-wider block">SLA Breached</span>
            <div className="text-3xl font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
              {stats.overdue}
              {stats.overdue > 0 && <AlertTriangle className="h-4 w-4 animate-bounce text-rose-600" />}
            </div>
            <p className="text-sm text-rose-600/80">Overdue resolution target</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-soft bg-amber-50/50 dark:bg-amber-950/30">
          <CardContent className="p-4 space-y-1">
            <span className="text-sm text-amber-700 dark:text-amber-300 font-semibold uppercase tracking-wider block">Escalated (L2 / L3)</span>
            <div className="text-3xl font-bold text-amber-700 dark:text-amber-300">
              {stats.level2 + stats.level3}
            </div>
            <p className="text-sm text-amber-600/80">{stats.level3} to Medical Director</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-soft bg-emerald-50/50 dark:bg-emerald-950/30">
          <CardContent className="p-4 space-y-1">
            <span className="text-sm text-emerald-700 dark:text-emerald-300 font-semibold uppercase tracking-wider block">Resolved</span>
            <div className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">{stats.resolved}</div>
            <p className="text-sm text-emerald-600/80">Corrective actions taken</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card className="border shadow-xs">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search ticket number, title, or patient..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>

            {/* Department */}
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="w-auto min-w-[160px] h-9 text-sm">
                <SelectValue placeholder="Department">
                  {deptFilter === "all" ? "All Departments" : departments.find((d) => d.id === deptFilter)?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" label="All Departments">All Departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id} label={d.name}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Severity */}
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-auto min-w-[140px] h-9 text-sm">
                <SelectValue placeholder="Severity">
                  {severityFilter === "all" ? "All Severities" : COMPLAINT_SEVERITY_LABELS[severityFilter]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" label="All Severities">All Severities</SelectItem>
                {Object.entries(COMPLAINT_SEVERITY_LABELS).map(([k, l]) => (
                  <SelectItem key={k} value={k} label={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-auto min-w-[150px] h-9 text-sm">
                <SelectValue placeholder="Status">
                  {statusFilter === "all" ? "All Statuses" : COMPLAINT_STATUS_LABELS[statusFilter]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" label="All Statuses">All Statuses</SelectItem>
                {Object.entries(COMPLAINT_STATUS_LABELS).map(([k, l]) => (
                  <SelectItem key={k} value={k} label={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Escalation Level */}
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-auto min-w-[190px] h-9 text-sm">
                <SelectValue placeholder="Escalation Level">
                  {levelFilter === "all" ? "All Authority Levels" : ESCALATION_LEVEL_LABELS[levelFilter]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" label="All Authority Levels">All Authority Levels</SelectItem>
                {Object.entries(ESCALATION_LEVEL_LABELS).map(([k, l]) => (
                  <SelectItem key={k} value={k} label={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
                setSeverityFilter("all");
                setDeptFilter("all");
                setLevelFilter("all");
              }}
              className="h-9 text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tickets List */}
      {complaints.length === 0 ? (
        <Card className="border shadow-soft p-12 text-center">
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-foreground">No Grievances Found</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              No tickets match your filters. Click &quot;Seed Demo Tickets&quot; above to populate sample tickets for testing.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {complaints.map((c) => {
            const deadline = new Date(c.slaDeadline);
            const isOverdue = ["SUBMITTED", "ASSIGNED", "UNDER_INVESTIGATION"].includes(c.status) && deadline < now;
            const diffHours = Math.round((deadline.getTime() - now.getTime()) / (1000 * 60 * 60));

            return (
              <Card
                key={c.id}
                className={`border shadow-xs transition-all hover:shadow-soft ${
                  isOverdue ? "border-rose-300 bg-rose-50/20 dark:border-rose-900/60" : ""
                }`}
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left details */}
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-sm text-primary">{c.ticketNumber}</span>
                        <Badge variant="outline" className={`text-xs ${severityBadges[c.severity]}`}>
                          {COMPLAINT_SEVERITY_LABELS[c.severity]}
                        </Badge>
                        <Badge variant="outline" className={`text-xs ${statusBadges[c.status]}`}>
                          {COMPLAINT_STATUS_LABELS[c.status]}
                        </Badge>
                        <Badge variant="outline" className={`text-xs ${escalationBadges[c.escalationLevel]}`}>
                          {ESCALATION_LEVEL_LABELS[c.escalationLevel]}
                        </Badge>
                      </div>

                      <div>
                        <h4 className="font-bold text-base text-foreground leading-snug">{c.title}</h4>
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{c.description}</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground pt-1">
                        <span className="flex items-center gap-1 font-medium text-foreground">
                          <Building2 className="h-3.5 w-3.5 text-primary" />
                          {c.department?.name}
                        </span>
                        <span>•</span>
                        <span>{COMPLAINT_CATEGORY_LABELS[c.category] || c.category}</span>
                        <span>•</span>
                        <span>
                          Reporter: {c.isAnonymous ? "Anonymous Patient" : c.patientName || "Walk-in"}
                        </span>
                        <span>•</span>
                        <span>Submitted {new Date(c.createdAt).toLocaleDateString("en-US")}</span>
                      </div>
                    </div>

                    {/* Right side: SLA Status & Action Button */}
                    <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end justify-between gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0">
                      {/* SLA Pill */}
                      {c.status === "RESOLVED" || c.status === "CLOSED" ? (
                        <div className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400 font-semibold">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Resolved</span>
                        </div>
                      ) : isOverdue ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 text-sm font-bold animate-pulse">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <span>SLA Breached ({Math.abs(diffHours)}h overdue)</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{diffHours}h left before next escalation</span>
                        </div>
                      )}

                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedComplaint(c);
                          setDialogOpen(true);
                        }}
                        className="gap-1.5 font-semibold text-sm"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        {c.status === "RESOLVED" || c.status === "CLOSED" ? "View Details" : "Investigate & Resolve"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Resolve / Investigation Modal */}
      {selectedComplaint && (
        <ResolveDialog
          complaint={selectedComplaint}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onUpdated={refreshData}
        />
      )}
    </div>
  );
}
