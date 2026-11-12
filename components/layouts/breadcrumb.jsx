"use client";

import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

export function Breadcrumb({ items }) {
  return (
    <nav className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-card/60 border border-border/40 backdrop-blur-sm text-xs sm:text-sm text-muted-foreground shadow-xs animate-in fade-in duration-300">
      <Link href="/dashboard" className="flex items-center gap-1 hover:text-primary transition-colors p-1 rounded-md hover:bg-background/80">
        <Home className="size-3.5" />
      </Link>
      {items?.map((item, index) => (
        <div key={index} className="flex items-center gap-1.5">
          <ChevronRight className="size-3.5 text-muted-foreground/50" />
          {item.href ? (
            <Link href={item.href} className="hover:text-primary transition-colors font-semibold p-1 rounded-md hover:bg-background/80">
              {item.label}
            </Link>
          ) : (
            <span className="font-extrabold text-foreground bg-background px-2 py-0.5 rounded-md border border-border/50 shadow-xs">
              {item.label}
            </span>
          )}
        </div>
      ))}
    </nav>
  );
}