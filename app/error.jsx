"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({ error, reset }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center bg-background relative overflow-hidden animate-in fade-in duration-500">
      {/* Background ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-red-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md bg-card/80 backdrop-blur-xl border border-red-100 dark:border-red-900/30 shadow-soft rounded-[2.5rem] p-8 sm:p-10 flex flex-col items-center">
        <div className="rounded-3xl bg-red-100 dark:bg-red-900/30 p-5 mb-6 text-red-600 dark:text-red-400 shadow-inner">
          <AlertTriangle className="size-10 animate-pulse" />
        </div>

        <span className="text-xs font-extrabold uppercase tracking-widest text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/40 px-3.5 py-1 rounded-full mb-3">
          Error 500
        </span>

        <h1 className="text-3xl font-extrabold tracking-tight text-foreground mb-2">
          System Exception
        </h1>

        <p className="text-sm font-medium text-muted-foreground leading-relaxed mb-8">
          An unexpected error occurred in the system. Please try refreshing or contact technical support if the issue persists.
        </p>

        <Button 
          onClick={reset}
          className="w-full h-12 text-base font-bold rounded-xl gradient-primary border-0 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all"
        >
          <RefreshCw className="mr-2 size-5" /> Try Again
        </Button>
      </div>
    </div>
  );
}