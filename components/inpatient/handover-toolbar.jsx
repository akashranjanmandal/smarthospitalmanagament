"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer } from "lucide-react";

export function HandoverToolbar({ wards }) {
  const router = useRouter();
  const params = useSearchParams();
  return (
    <div className="flex gap-2 print:hidden">
      <Select value={params.get("ward") ?? "all"} onValueChange={(v) => router.push(v === "all" ? "/handover" : `/handover?ward=${v}`)}>
        <SelectTrigger className="h-10 w-full rounded-lg sm:w-56" aria-label="Ward">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All wards</SelectItem>
          {wards.map((w) => <SelectItem key={w.id} value={w.id}>{w.name} · Floor {w.floor}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button variant="outline" className="h-10 gap-1.5 rounded-lg" onClick={() => window.print()}>
        <Printer className="size-4" /> Print
      </Button>
    </div>
  );
}
