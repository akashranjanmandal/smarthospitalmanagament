"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Mail, MessageCircle, Printer } from "lucide-react";

/** Print, or open WhatsApp / email with the summary filled in. Nothing is sent without staff pressing send. */
export function ShareSummary({ text, phone, email }) {
  const digits = phone?.replace(/\D/g, "").slice(-10);
  const whatsapp = `https://wa.me/${digits?.length === 10 ? `91${digits}` : ""}?text=${encodeURIComponent(text)}`;
  const mail = email ? `mailto:${email}?subject=${encodeURIComponent("Your discharge summary")}&body=${encodeURIComponent(text)}` : null;
  return (
    <div className="flex flex-wrap gap-2">
      <a href={whatsapp} target="_blank" rel="noreferrer" className={cn(buttonVariants({ size: "sm" }), "gap-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700")}>
        <MessageCircle className="size-4" /> WhatsApp
      </a>
      {mail && (
        <a href={mail} className={cn(buttonVariants({ size: "sm", variant: "outline" }), "gap-1.5 rounded-lg")}>
          <Mail className="size-4" /> Email
        </a>
      )}
      <Button size="sm" variant="outline" className="gap-1.5 rounded-lg" onClick={() => window.print()}>
        <Printer className="size-4" /> Print
      </Button>
    </div>
  );
}
