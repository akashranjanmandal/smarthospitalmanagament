"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { recordSignIn, recordTimeOut, recordSignOut, cancelOT } from "@/actions/ot";
import { Panel, Chip } from "@/components/inpatient/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmtDateTime } from "@/lib/format";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";

const STEPS = [
  { key: "signIn", label: "Sign-in", hint: "Before induction of anaesthesia — confirms patient identity, site, procedure and consent.", action: recordSignIn },
  { key: "timeOut", label: "Time-out", hint: "Before skin incision — team confirms patient, site and procedure aloud together.", action: recordTimeOut },
  { key: "signOut", label: "Sign-out", hint: "Before the patient leaves theatre — confirms the procedure, counts and specimens.", action: recordSignOut },
];

export function OTChecklist({ booking, canAct }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const run = async (fn) => {
    setBusy(true);
    const res = await fn(booking.id);
    setBusy(false);
    if (!res.success) return toast.error(res.message);
    toast.success(res.message);
    router.refresh();
  };

  const doCancel = async () => {
    if (!cancelReason.trim()) return toast.error("Enter a reason");
    setBusy(true);
    const res = await cancelOT(booking.id, cancelReason);
    setBusy(false);
    if (!res.success) return toast.error(res.message);
    toast.success(res.message);
    setCancelling(false);
    router.refresh();
  };

  const canCancel = canAct && booking.status !== "COMPLETED" && booking.status !== "CANCELLED";

  return (
    <Panel title="WHO Surgical Safety Checklist">
      <div className="space-y-3">
        {STEPS.map(({ key, label, hint, action }, i) => {
          const at = booking[`${key}At`];
          const by = booking[`${key}By`];
          const prior = i === 0 || booking[`${STEPS[i - 1].key}At`];
          return (
            <div key={key} className="flex items-start gap-3 rounded-lg border border-border/60 p-3">
              {at ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" /> : <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground" />}
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{label}</div>
                <p className="text-xs text-muted-foreground">{hint}</p>
                {at ? (
                  <p className="mt-1 text-xs text-muted-foreground">{fmtDateTime(at)} · {by ? `${by.firstName} ${by.lastName}` : "—"}</p>
                ) : canAct && prior && booking.status !== "CANCELLED" ? (
                  <Button size="sm" disabled={busy} onClick={() => run(action)} className="mt-2 h-7 rounded-lg text-xs">
                    {busy && <Loader2 className="size-3.5 animate-spin" />} Confirm {label.toLowerCase()}
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}

        {booking.status === "CANCELLED" && <Chip tone="neutral">Cancelled: {booking.cancelReason}</Chip>}
        {booking.status === "COMPLETED" && <Chip tone="good">Procedure complete</Chip>}

        {canCancel && (
          cancelling ? (
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Reason for cancelling" className="h-8 w-56 rounded-lg text-xs" />
              <Button size="sm" variant="destructive" className="h-8 rounded-lg text-xs" onClick={doCancel} disabled={busy}>Confirm cancel</Button>
              <Button size="sm" variant="ghost" className="h-8 rounded-lg text-xs" onClick={() => setCancelling(false)}>Back</Button>
            </div>
          ) : (
            <button type="button" onClick={() => setCancelling(true)} className="pt-1 text-xs font-semibold text-destructive hover:underline">Cancel this procedure</button>
          )
        )}
      </div>
    </Panel>
  );
}
