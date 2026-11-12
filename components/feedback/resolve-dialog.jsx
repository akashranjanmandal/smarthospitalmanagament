"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { updateComplaintStatus, escalateComplaint } from "@/actions/feedback";
import {
  COMPLAINT_STATUS_LABELS,
  COMPLAINT_SEVERITY_LABELS,
  ESCALATION_LEVEL_LABELS,
} from "@/lib/constants";
import { toast } from "sonner";
import { CheckCircle2, ArrowUpRight, Loader2, MessageSquareWarning } from "lucide-react";

export function ResolveDialog({ complaint, open, onOpenChange, onUpdated }) {
  const [status, setStatus] = useState(complaint?.status || "UNDER_INVESTIGATION");
  const [resolutionSummary, setResolutionSummary] = useState(complaint?.resolutionSummary || "");
  const [actionTaken, setActionTaken] = useState(complaint?.actionTaken || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEscalating, setIsEscalating] = useState(false);

  if (!complaint) return null;

  const handleUpdate = async () => {
    if ((status === "RESOLVED" || status === "CLOSED") && !resolutionSummary.trim()) {
      toast.error("Please provide a summary of the resolution.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await updateComplaintStatus(complaint.id, {
        status,
        resolutionSummary,
        actionTaken,
      });

      if (res.success) {
        toast.success(res.message);
        onUpdated();
        onOpenChange(false);
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      console.error("Status update error:", err);
      toast.error("Failed to update status.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualEscalate = async () => {
    let nextLevel = "LEVEL_2_ADMIN";
    if (complaint.escalationLevel === "LEVEL_2_ADMIN") {
      nextLevel = "LEVEL_3_DIRECTOR";
    }

    setIsEscalating(true);
    try {
      const res = await escalateComplaint(complaint.id, {
        targetLevel: nextLevel,
        reason: "Manual supervisor escalation override by staff",
      });

      if (res.success) {
        toast.success(res.message);
        onUpdated();
        onOpenChange(false);
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      console.error("Manual escalate error:", err);
      toast.error("Failed to escalate ticket.");
    } finally {
      setIsEscalating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-4">
            <DialogTitle className="flex items-center gap-2">
              <MessageSquareWarning className="h-5 w-5 text-primary" />
              Ticket {complaint.ticketNumber}
            </DialogTitle>
            <Badge variant="outline">
              {COMPLAINT_SEVERITY_LABELS[complaint.severity]} Priority
            </Badge>
          </div>
          <DialogDescription>
            {complaint.title} • {complaint.department?.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs sm:text-sm">
          {/* Patient Details */}
          <div className="p-3 rounded-lg bg-muted/30 border space-y-1">
            <span className="font-semibold text-foreground block">Patient / Reporter:</span>
            {complaint.isAnonymous ? (
              <span className="text-muted-foreground italic">Anonymous Submission (Contact withheld)</span>
            ) : (
              <p className="text-foreground">
                <strong>{complaint.patientName || "Name not given"}</strong>
                {complaint.patientPhone && ` • Phone: ${complaint.patientPhone}`}
                {complaint.patientEmail && ` • Email: ${complaint.patientEmail}`}
              </p>
            )}
            <p className="text-muted-foreground pt-1 border-t mt-1">
              <strong>Reported Issue:</strong> {complaint.description}
            </p>
            {complaint.location && (
              <p className="text-muted-foreground">
                <strong>Location:</strong> {complaint.location}
              </p>
            )}
          </div>

          {/* Current Authority Level */}
          <div className="flex items-center justify-between p-2.5 rounded-lg border bg-card">
            <div>
              <span className="text-muted-foreground text-xs block">Current Authority:</span>
              <span className="font-bold text-foreground">
                {ESCALATION_LEVEL_LABELS[complaint.escalationLevel]}
              </span>
            </div>
            {complaint.escalationLevel !== "LEVEL_3_DIRECTOR" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleManualEscalate}
                disabled={isEscalating}
                className="gap-1.5 text-xs text-amber-600 border-amber-300 hover:bg-amber-50 dark:border-amber-800 dark:hover:bg-amber-950/40"
              >
                {isEscalating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                Escalate Level
              </Button>
            )}
          </div>

          {/* Status Selection */}
          <div className="space-y-2">
            <Label htmlFor="status-select" className="text-sm font-semibold">
              Update Status
            </Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="status-select">
                <SelectValue placeholder="Select Status" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(COMPLAINT_STATUS_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Resolution Summary */}
          <div className="space-y-2">
            <Label htmlFor="summary-text" className="text-sm font-semibold">
              Investigation Findings / Resolution Summary
            </Label>
            <Textarea
              id="summary-text"
              placeholder="Explain findings, communication with patient, or resolution details..."
              value={resolutionSummary}
              onChange={(e) => setResolutionSummary(e.target.value)}
              rows={3}
              className="resize-none text-xs sm:text-sm"
            />
          </div>

          {/* Action Taken */}
          <div className="space-y-2">
            <Label htmlFor="action-text" className="text-sm font-semibold">
              Corrective Action Taken
            </Label>
            <Textarea
              id="action-text"
              placeholder="e.g., Housekeeping team sanitized ward, duty doctor warned, billing discrepancy refunded..."
              value={actionTaken}
              onChange={(e) => setActionTaken(e.target.value)}
              rows={2}
              className="resize-none text-xs sm:text-sm"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleUpdate} disabled={isSubmitting} className="gap-1.5 font-bold">
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Save & Update Ticket
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
