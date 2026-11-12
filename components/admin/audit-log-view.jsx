"use client";

import { Fragment, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Chip } from "@/components/inpatient/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtDateTime, fullName } from "@/lib/format";
import { getRoleLabel } from "@/lib/roles";
import { ChevronDown, ChevronRight } from "lucide-react";

const ACTIONS = [
  ["all", "All actions"],
  ["CREATE", "Created"],
  ["UPDATE", "Updated"],
  ["DELETE", "Deleted"],
  ["VIEW", "Viewed"],
  ["LOGIN", "Signed in"],
  ["LOGIN_FAILED", "Failed sign-in"],
];
const TONE = { CREATE: "good", UPDATE: "info", DELETE: "bad", VIEW: "neutral", LOGIN: "neutral", LOGIN_FAILED: "warn" };
const humanize = (e) => e.replace(/([a-z])([A-Z])/g, "$1 $2");

export function AuditLogView({ data }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(null);

  const go = (changes) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v && v !== "all") next.set(k, v);
      else next.delete(k);
    }
    if (!("page" in changes)) next.delete("page");
    router.push(`${pathname}?${next}`);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <Select value={params.get("entity") ?? "all"} onValueChange={(v) => go({ entity: v })}>
          <SelectTrigger className="h-10 w-full rounded-lg lg:w-48" aria-label="Record type"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All records</SelectItem>
            {data.entities.map((e) => <SelectItem key={e} value={e}>{humanize(e)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={params.get("action") ?? "all"} onValueChange={(v) => go({ action: v })}>
          <SelectTrigger className="h-10 w-full rounded-lg lg:w-44" aria-label="Action"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ACTIONS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Input type="date" aria-label="From date" defaultValue={params.get("from") ?? ""} onChange={(e) => go({ from: e.target.value })} className="h-10 rounded-lg" />
          <Input type="date" aria-label="To date" defaultValue={params.get("to") ?? ""} onChange={(e) => go({ to: e.target.value })} className="h-10 rounded-lg" />
        </div>
        <form className="flex-1" onSubmit={(e) => { e.preventDefault(); go({ q: new FormData(e.currentTarget).get("q") }); }}>
          <Input name="q" defaultValue={params.get("q") ?? ""} placeholder="Record ID" className="h-10 rounded-lg" aria-label="Record ID" />
        </form>
        {params.get("actor") && <Button variant="outline" className="h-10 rounded-lg" onClick={() => go({ actor: "" })}>Clear person filter</Button>}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/70 bg-card">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="w-8 px-2 py-2.5" />
              <th className="px-3 py-2.5">When</th>
              <th className="min-w-44 px-3 py-2.5">Who</th>
              <th className="px-3 py-2.5">What</th>
              <th className="w-64 px-3 py-2.5">Record</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {data.logs.length === 0 && (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No activity matches these filters.</td></tr>
            )}
            {data.logs.map((log) => (
              <Fragment key={log.id}>
                <tr className="cursor-pointer hover:bg-muted/30" onClick={() => setOpen(open === log.id ? null : log.id)}>
                  <td className="px-2 py-2.5 text-muted-foreground">{open === log.id ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{fmtDateTime(log.createdAt)}</td>
                  <td className="px-3 py-2.5">
                    {log.actor ? (
                      <button type="button" className="text-left hover:underline" onClick={(e) => { e.stopPropagation(); go({ actor: log.actor.id }); }}>
                        <span className="font-medium">{fullName(log.actor) || log.actor.email}</span>
                        <span className="block text-xs text-muted-foreground">{getRoleLabel(log.actor.role)}</span>
                      </button>
                    ) : (
                      <span className="text-muted-foreground">System / signed-out</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5"><Chip tone={TONE[log.action] ?? "neutral"} className="whitespace-normal break-words leading-snug">{log.summary}</Chip></td>
                  <td className="break-all px-3 py-2.5 font-mono text-xs text-muted-foreground">{humanize(log.entity)} {log.entityId ? `· ${log.entityId}` : ""}</td>
                </tr>
                {open === log.id && (
                  <tr className="bg-muted/20">
                    <td />
                    <td colSpan={4} className="px-3 py-3"><ChangeDetails changes={log.changes} /></td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{data.total} entries · page {data.page} of {data.totalPages}</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="rounded-lg" disabled={data.page <= 1} onClick={() => go({ page: String(data.page - 1) })}>Previous</Button>
          <Button variant="outline" size="sm" className="rounded-lg" disabled={data.page >= data.totalPages} onClick={() => go({ page: String(data.page + 1) })}>Next</Button>
        </div>
      </div>
    </div>
  );
}

const show = (v) => (v === null || v === undefined || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));

function ChangeDetails({ changes }) {
  if (!changes) return <p className="text-muted-foreground">No details recorded.</p>;
  if (changes.fields) {
    if (!changes.fields.length) return <p className="text-muted-foreground">Saved with no field changes.</p>;
    return (
      <table className="text-xs">
        <thead className="text-left text-muted-foreground"><tr><th className="pr-6 font-medium">Field</th><th className="pr-6 font-medium">Before</th><th className="font-medium">After</th></tr></thead>
        <tbody>
          {changes.fields.map((f) => (
            <tr key={f} className="align-top">
              <td className="py-0.5 pr-6 font-semibold">{f}</td>
              <td className="max-w-xs break-words py-0.5 pr-6 text-rose-700 line-through decoration-rose-300 dark:text-rose-300">{show(changes.before?.[f])}</td>
              <td className="max-w-xs break-words py-0.5 text-emerald-700 dark:text-emerald-300">{show(changes.after?.[f])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  const record = changes.after ?? changes.before ?? changes;
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2 lg:grid-cols-3">
      {Object.entries(record).map(([k, v]) => (
        <div key={k} className="flex min-w-0 gap-2"><dt className="shrink-0 font-semibold">{k}</dt><dd className="truncate text-muted-foreground" title={show(v)}>{show(v)}</dd></div>
      ))}
    </dl>
  );
}
