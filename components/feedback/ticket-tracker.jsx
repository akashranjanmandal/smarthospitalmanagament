"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  COMPLAINT_CATEGORY_LABELS,
  COMPLAINT_SEVERITY_LABELS,
  COMPLAINT_STATUS_LABELS,
  ESCALATION_LEVEL_LABELS,
} from "@/lib/constants";
import { trackTicketPublic } from "@/actions/feedback";
import {
  Search,
  Loader2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  Layers,
} from "lucide-react";

const statusColors = {
  SUBMITTED: "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300",
  ASSIGNED: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300",
  UNDER_INVESTIGATION: "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300",
  RESOLVED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300",
  REJECTED: "bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300",
  CLOSED: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
};

const escalationColors = {
  LEVEL_1_DEPT_HEAD: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
  LEVEL_2_ADMIN: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  LEVEL_3_DIRECTOR: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
};

export function TicketTracker({ initialCode = "" }) {
  const [code, setCode] = useState(initialCode);
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSearch = useCallback(async (queryCode) => {
    const searchVal = (queryCode || code).trim().toUpperCase();
    if (!searchVal) return;

    setLoading(true);
    setErrorMsg("");
    setSearched(true);
    try {
      const res = await trackTicketPublic(searchVal);
      if (res.success) {
        setTicket(res.data);
      } else {
        setTicket(null);
        setErrorMsg(res.message);
      }
    } catch (err) {
      console.error("Tracking lookup error:", err);
      setTicket(null);
      setErrorMsg("Failed to search ticket. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    if (initialCode) {
      let isMounted = true;
      (async () => {
        setLoading(true);
        setErrorMsg("");
        setSearched(true);
        try {
          const res = await trackTicketPublic(initialCode.trim().toUpperCase());
          if (isMounted) {
            if (res.success) {
              setTicket(res.data);
            } else {
              setTicket(null);
              setErrorMsg(res.message);
            }
          }
        } catch (err) {
          console.error("Tracking lookup error:", err);
          if (isMounted) {
            setTicket(null);
            setErrorMsg("Failed to search ticket.");
          }
        } finally {
          if (isMounted) setLoading(false);
        }
      })();
      return () => {
        isMounted = false;
      };
    }
  }, [initialCode]);

  const calculateSlaStatus = () => {
    if (!ticket) return null;
    if (ticket.status === "RESOLVED" || ticket.status === "CLOSED") {
      return { isResolved: true, text: "Resolved" };
    }
    const now = new Date();
    const deadline = new Date(ticket.slaDeadline);
    const diffMs = deadline.getTime() - now.getTime();

    if (diffMs <= 0) {
      const overdueHours = Math.abs(Math.floor(diffMs / (1000 * 60 * 60)));
      return { isOverdue: true, text: `Overdue by ${overdueHours}h (Escalated to higher authority)` };
    }
    const hoursLeft = Math.floor(diffMs / (1000 * 60 * 60));
    const minsLeft = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return { isOverdue: false, text: `${hoursLeft}h ${minsLeft}m remaining before next escalation` };
  };

  const slaInfo = calculateSlaStatus();

  return (
    <div className="space-y-6">
      {/* Search Input Bar */}
      <Card className="border shadow-soft">
        <CardContent className="p-4 sm:p-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
            className="flex flex-col sm:flex-row gap-3"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Enter Ticket Reference (e.g. TKT-9F3B2A)"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="pl-10 h-12 font-mono uppercase tracking-wider text-base"
                required
              />
            </div>
            <Button
              type="submit"
              size="lg"
              disabled={loading}
              className="h-12 px-6 font-semibold gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Track Grievance
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Error state */}
      {searched && !loading && errorMsg && (
        <Card className="border-destructive/30 bg-destructive/5 text-center p-8">
          <div className="flex flex-col items-center justify-center space-y-2">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <p className="font-semibold text-foreground">{errorMsg}</p>
            <p className="text-xs text-muted-foreground">Please double check your reference code format (e.g., TKT-XXXXXX).</p>
          </div>
        </Card>
      )}

      {/* Ticket Details Display */}
      {ticket && !loading && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Header Card */}
          <Card className="border shadow-soft overflow-hidden">
            <CardHeader className="bg-muted/30 border-b pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono font-bold text-xl text-primary">{ticket.ticketNumber}</span>
                    <Badge className={statusColors[ticket.status] || "bg-muted"}>
                      {COMPLAINT_STATUS_LABELS[ticket.status] || ticket.status}
                    </Badge>
                  </div>
                  <CardTitle className="text-2xl">{ticket.title}</CardTitle>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`px-2.5 py-1 text-sm border ${escalationColors[ticket.escalationLevel]}`}>
                    <Layers className="h-3 w-3 mr-1 inline" />
                    {ESCALATION_LEVEL_LABELS[ticket.escalationLevel]}
                  </Badge>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-6 space-y-6">
              {/* Meta information tags */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div className="p-2.5 rounded-lg bg-muted/40 border space-y-0.5">
                  <span className="text-muted-foreground block">Department</span>
                  <span className="font-semibold text-foreground flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5 text-primary" />
                    {ticket.department.name}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/40 border space-y-0.5">
                  <span className="text-muted-foreground block">Category</span>
                  <span className="font-semibold text-foreground">
                    {COMPLAINT_CATEGORY_LABELS[ticket.category] || ticket.category}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/40 border space-y-0.5">
                  <span className="text-muted-foreground block">Urgency / Severity</span>
                  <span className="font-semibold text-foreground">
                    {COMPLAINT_SEVERITY_LABELS[ticket.severity] || ticket.severity}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-muted/40 border space-y-0.5">
                  <span className="text-muted-foreground block">Submitted On</span>
                  <span className="font-semibold text-foreground">
                    {new Date(ticket.createdAt).toLocaleDateString("en-US")} at {new Date(ticket.createdAt).toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              {/* SLA Status Bar */}
              {slaInfo && (
                <div className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-sm ${
                  slaInfo.isResolved
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                    : slaInfo.isOverdue
                    ? "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                    : "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                }`}>
                  <div className="flex items-center gap-2">
                    {slaInfo.isResolved ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : slaInfo.isOverdue ? (
                      <AlertTriangle className="h-4 w-4 text-rose-600 animate-pulse" />
                    ) : (
                      <Clock className="h-4 w-4 text-blue-600" />
                    )}
                    <span className="font-bold">SLA Guarantee Status:</span>
                    <span>{slaInfo.text}</span>
                  </div>
                  <span className="text-sm opacity-75 hidden sm:inline">
                    Target: {new Date(ticket.slaDeadline).toLocaleString("en-US")}
                  </span>
                </div>
              )}

              {/* Description */}
              <div className="space-y-1.5 text-base">
                <span className="font-semibold text-foreground block">Reported Details:</span>
                <p className="text-muted-foreground bg-muted/20 p-3.5 rounded-xl border whitespace-pre-wrap leading-relaxed">
                  {ticket.description}
                </p>
                {ticket.location && (
                  <p className="text-sm text-muted-foreground">
                    📍 Location: <strong className="text-foreground">{ticket.location}</strong>
                  </p>
                )}
              </div>

              {/* Resolution Card if resolved */}
              {ticket.resolutionSummary && (
                <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
                    <CheckCircle2 className="h-4 w-4" />
                    Resolution & Corrective Action Taken
                  </div>
                  <p className="text-sm text-emerald-900 dark:text-emerald-200 leading-relaxed">
                    {ticket.resolutionSummary}
                  </p>
                  {ticket.actionTaken && (
                    <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
                      Action Taken: {ticket.actionTaken}
                    </p>
                  )}
                  {ticket.resolvedAt && (
                    <span className="text-sm text-muted-foreground block pt-1">
                      Resolved on {new Date(ticket.resolvedAt).toLocaleString("en-US")}
                    </span>
                  )}
                </div>
              )}

              {/* Step Milestone Progress */}
              <div className="space-y-3 pt-2">
                <span className="font-semibold text-base block">Resolution Journey</span>
                <div className="space-y-3 border-l-2 border-primary/30 pl-4 ml-2">
                  {ticket.escalationLogs?.map((log) => (
                    <div key={log.id} className="relative space-y-1 text-sm">
                      <div className="absolute -left-[23px] top-1 h-3 w-3 rounded-full bg-primary ring-4 ring-background" />
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground">{log.triggerReason}</span>
                        <span className="text-muted-foreground text-sm">
                          {new Date(log.createdAt).toLocaleDateString("en-US")} at {new Date(log.createdAt).toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-sm">
                        Authority: {ESCALATION_LEVEL_LABELS[log.toLevel] || log.toLevel}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
