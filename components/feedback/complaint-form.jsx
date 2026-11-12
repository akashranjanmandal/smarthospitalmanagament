"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  COMPLAINT_CATEGORY_LABELS,
  COMPLAINT_SEVERITY_LABELS,
  SLA_HOURS_BY_SEVERITY,
} from "@/lib/constants";
import { submitPublicFeedback } from "@/actions/feedback";
import { toast } from "sonner";
import {
  AlertCircle,
  Clock,
  Send,
  Loader2,
  CheckCircle2,
  Copy,
  EyeOff,
  User,
  Heart,
  MessageSquareWarning,
  Sparkles,
  Stethoscope,
  ShieldCheck,
} from "lucide-react";

const categoryIcons = {
  STAFF_BEHAVIOR: <User className="h-4 w-4" />,
  WAIT_TIME: <Clock className="h-4 w-4" />,
  CLEANLINESS: <Sparkles className="h-4 w-4" />,
  BILLING_ISSUE: <AlertCircle className="h-4 w-4" />,
  TREATMENT_QUALITY: <Stethoscope className="h-4 w-4" />,
  FACILITY_AMENITIES: <ShieldCheck className="h-4 w-4" />,
  MEDICATION_ERROR: <AlertCircle className="h-4 w-4" />,
  OTHER: <MessageSquareWarning className="h-4 w-4" />,
};

const severityStyles = {
  CRITICAL: "border-rose-300 bg-rose-50/50 hover:bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/20",
  HIGH: "border-amber-300 bg-amber-50/50 hover:bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/20",
  MEDIUM: "border-blue-300 bg-blue-50/50 hover:bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/20",
  LOW: "border-slate-300 bg-slate-50/50 hover:bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/20",
};

export function ComplaintForm({ departments, onTrackTicket }) {
  const [type, setType] = useState("COMPLAINT");
  const [category, setCategory] = useState("WAIT_TIME");
  const [severity, setSeverity] = useState("MEDIUM");
  const [departmentId, setDepartmentId] = useState(departments[0]?.id || "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Receipt Modal
  const [receipt, setReceipt] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!departmentId) {
      toast.error("Please select the concerned department");
      return;
    }
    if (!title.trim()) {
      toast.error("Please provide a short summary/title");
      return;
    }
    if (!description.trim() || description.length < 10) {
      toast.error("Please describe your issue in at least 10 characters");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitPublicFeedback({
        type,
        category,
        severity,
        departmentId,
        title,
        description,
        location,
        isAnonymous,
        patientName,
        patientPhone,
        patientEmail,
      });

      if (res.success) {
        toast.success(res.message);
        setReceipt(res);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("refresh-notifications"));
        }
        // Reset form
        setTitle("");
        setDescription("");
        setLocation("");
        setPatientName("");
        setPatientPhone("");
        setPatientEmail("");
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      console.error("Submission failed:", err);
      toast.error("Failed to submit. Please check your connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyTicket = () => {
    if (receipt?.ticketNumber) {
      navigator.clipboard.writeText(receipt.ticketNumber);
      toast.success("Ticket reference copied to clipboard!");
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Type Selection */}
        <div className="space-y-2">
          <Label className="text-base font-semibold">Feedback Type</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { key: "COMPLAINT", label: "Complaint", desc: "Report grievance", icon: <AlertCircle className="h-4 w-4" /> },
              { key: "FEEDBACK", label: "Feedback", desc: "General input", icon: <MessageSquareWarning className="h-4 w-4" /> },
              { key: "COMPLIMENT", label: "Compliment", desc: "Praise staff", icon: <Heart className="h-4 w-4" /> },
              { key: "SUGGESTION", label: "Suggestion", desc: "Improvement idea", icon: <Sparkles className="h-4 w-4" /> },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setType(t.key)}
                    className={`min-w-0 p-2 sm:p-3 rounded-xl border text-left transition-all duration-200 cursor-pointer ${
                  type === t.key
                    ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20 font-semibold"
                    : "border-border hover:bg-muted/50 text-muted-foreground"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {t.icon}
                  <span className="text-base font-bold text-foreground">{t.label}</span>
                </div>
                <span className="text-sm block text-muted-foreground">{t.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Department & Category */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="dept-select" className="text-base font-semibold">
              Concerned Department <span className="text-destructive">*</span>
            </Label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger id="dept-select" className="h-11">
                <SelectValue placeholder="Select Department">
                  {departments.find((d) => d.id === departmentId)?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id} label={d.name}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category-select" className="text-base font-semibold">
              Category Tag <span className="text-destructive">*</span>
            </Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category-select" className="h-11">
                <SelectValue placeholder="Select Category">
                  {COMPLAINT_CATEGORY_LABELS[category] ? (
                    <div className="flex items-center gap-2">
                      {categoryIcons[category]}
                      <span>{COMPLAINT_CATEGORY_LABELS[category]}</span>
                    </div>
                  ) : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(COMPLAINT_CATEGORY_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key} label={label}>
                    <div className="flex items-center gap-2">
                      {categoryIcons[key]}
                      <span>{label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Severity & SLA Matrix */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">Urgency & Severity Level</Label>
            <span className="text-sm text-muted-foreground flex items-center gap-1 text-right leading-tight">
              <Clock className="h-3 w-3" /> Time-bound escalation guarantee
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Object.entries(COMPLAINT_SEVERITY_LABELS).map(([key, label]) => {
              const hours = SLA_HOURS_BY_SEVERITY[key];
              const isSelected = severity === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSeverity(key)}
                  className={`p-3 rounded-xl border text-left transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? `ring-2 ring-primary ${severityStyles[key]} font-bold`
                      : "border-border hover:bg-muted/40 opacity-70 hover:opacity-100"
                  }`}
                >
                  <p className="text-sm font-bold text-foreground">{label}</p>
                  <Badge variant="outline" className="mt-1 w-full min-w-0 justify-center whitespace-normal text-center text-xs leading-tight sm:text-sm">
                    {hours}h SLA Deadline
                  </Badge>
                </button>
              );
            })}
          </div>
        </div>

        {/* Title & Description */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-base font-semibold">
              Summary / Subject <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              placeholder="e.g., Long wait time in OPD or sanitation issue in Ward 3"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-11"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="desc" className="text-base font-semibold">
              Detailed Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="desc"
              placeholder="Please provide details including names, room numbers, or events..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="resize-none"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location" className="text-base font-semibold">
              Specific Ward / Room / Floor (Optional)
            </Label>
            <Input
              id="location"
              placeholder="e.g., 2nd Floor General Ward Bed 08"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
        </div>

        {/* Anonymous Mode & Contact Information */}
        <Card className="border shadow-xs bg-muted/20">
          <CardContent className="p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <EyeOff className="h-4 w-4 text-primary" />
                  <Label htmlFor="anonymous-toggle" className="text-base font-bold cursor-pointer">
                    Submit Anonymously
                  </Label>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Your identity will remain completely confidential. You can track progress with your ticket code.
                </p>
              </div>
              <input
                type="checkbox"
                id="anonymous-toggle"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
              />
            </div>

            {!isAnonymous && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t">
                <div className="space-y-1.5">
                  <Label htmlFor="pname" className="text-sm font-medium">Your Name</Label>
                  <Input
                    id="pname"
                    placeholder="Full name"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    className="h-10 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pphone" className="text-sm font-medium">Phone Number</Label>
                  <Input
                    id="pphone"
                    placeholder="+91 98765 43210"
                    value={patientPhone}
                    onChange={(e) => setPatientPhone(e.target.value)}
                    className="h-10 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pemail" className="text-sm font-medium">Email Address</Label>
                  <Input
                    id="pemail"
                    type="email"
                    placeholder="name@example.com"
                    value={patientEmail}
                    onChange={(e) => setPatientEmail(e.target.value)}
                    className="h-10 text-sm"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Button
          type="submit"
          size="lg"
          disabled={isSubmitting}
          className="w-full min-h-12 h-auto py-3 text-base font-bold gap-2 shadow-soft hover:shadow-hover whitespace-normal text-center leading-tight"
          id="submit-feedback-btn"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Routing to Department Head...
            </>
          ) : (
            <>
              <Send className="h-5 w-5" />
              Submit Grievance with Escalation Guarantee
            </>
          )}
        </Button>
      </form>

      {/* Confirmation Receipt Dialog */}
      {receipt && (
        <Dialog open={!!receipt} onOpenChange={() => setReceipt(null)}>
          <DialogContent className="sm:max-w-md text-center">
            <div className="flex flex-col items-center justify-center pt-4 space-y-4">
              <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <DialogHeader className="text-center">
                <DialogTitle className="text-xl font-bold">Feedback Successfully Logged</DialogTitle>
                <DialogDescription>
                  Your ticket has been directly routed to the <strong>{receipt.data?.departmentName}</strong> Department Head.
                </DialogDescription>
              </DialogHeader>

              {/* Reference Code Display */}
              <div className="p-4 rounded-xl bg-muted/60 border w-full space-y-2">
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold block">
                  Your Tracking Reference Code
                </span>
                <div className="flex items-center justify-center gap-2">
                  <span className="font-mono text-2xl font-black text-primary tracking-wider">
                    {receipt.ticketNumber}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={copyTicket}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    title="Copy Ticket"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Save this code to track your resolution status anytime, even without an account.
                </p>
              </div>

              {/* SLA Guarantee Banner */}
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-left text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2.5 w-full">
                <ShieldCheck className="h-5 w-5 shrink-0 text-blue-600 mt-0.5" />
                <div>
                  <span className="font-bold block">Escalation Timer Active</span>
                  If unresolved by the Department Head within SLA, our system automatically escalates this to the Hospital Administrator.
                </div>
              </div>
            </div>

            <DialogFooter className="sm:justify-center gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => setReceipt(null)}
              >
                Submit Another
              </Button>
              <Button
                onClick={() => {
                  const code = receipt.ticketNumber;
                  setReceipt(null);
                  onTrackTicket(code);
                }}
                className="gap-1.5"
              >
                Track Live Status
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
