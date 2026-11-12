"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export function PrintButton({ label = "Print" }) {
  return (
    <Button size="sm" variant="outline" className="gap-1.5 rounded-lg print:hidden" onClick={() => window.print()}>
      <Printer className="size-4" /> {label}
    </Button>
  );
}
