"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";

const STATUSES = [
  ["ADMITTED", "Currently admitted"],
  ["DISCHARGED", "Discharged"],
  ["all", "All admissions"],
];

export function AdmissionsFilters({ wards, status }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  const update = (key, value) => {
    const next = new URLSearchParams(params);
    if (value && value !== "all-wards") next.set(key, value);
    else next.delete(key);
    router.push(`${pathname}?${next}`);
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <form
        className="relative flex-1 sm:max-w-sm"
        onSubmit={(e) => {
          e.preventDefault();
          update("q", q.trim());
        }}
      >
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onBlur={() => q.trim() !== (params.get("q") ?? "") && update("q", q.trim())}
          placeholder="Name, UHID, phone or IP number"
          className="h-10 rounded-lg pl-9"
          aria-label="Search admissions"
        />
      </form>
      <Select value={status} onValueChange={(v) => update("status", v)}>
        <SelectTrigger className="h-10 w-full rounded-lg sm:w-52" aria-label="Admission status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUSES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
        </SelectContent>
      </Select>
      {wards.length > 0 && (
        <Select value={params.get("ward") ?? "all-wards"} onValueChange={(v) => update("ward", v)}>
          <SelectTrigger className="h-10 w-full rounded-lg sm:w-52" aria-label="Ward">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all-wards">All wards</SelectItem>
            {wards.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
