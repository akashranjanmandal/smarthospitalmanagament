"use client";

import { Button } from "@/components/ui/button";
import { AlertOctagon, RefreshCw } from "lucide-react";

export default function DashboardError({ error, reset }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 animate-in fade-in zoom-in-95 duration-500">
      <div className="max-w-md w-full bg-card border border-red-100 dark:border-red-900/30 shadow-xl rounded-[2.5rem] p-8 text-center relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-red-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-red-400/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col items-center">
          <div className="rounded-3xl bg-red-50 dark:bg-red-900/20 p-5 mb-6 border border-red-100 dark:border-red-900/50 shadow-inner">
            <AlertOctagon className="size-10 text-red-500 animate-pulse" />
          </div>
          
          <h2 className="text-2xl font-extrabold text-foreground mb-3 tracking-tight">
            System Interruption
          </h2>
          
          <div className="bg-muted/40 border border-border/50 rounded-2xl p-4 mb-8 w-full">
            <p className="text-sm font-medium text-muted-foreground leading-relaxed">
              {error?.message || "An unexpected error occurred while loading this module. Please try reloading the page."}
            </p>
          </div>
          
          <Button 
            onClick={reset} 
            className="w-full sm:w-auto h-12 gradient-primary border-0 rounded-xl font-bold shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 px-8"
          >
            <RefreshCw className="mr-2 size-4" /> Try Again
          </Button>
        </div>
      </div>
    </div>
  );
}