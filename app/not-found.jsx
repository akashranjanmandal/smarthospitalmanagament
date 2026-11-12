import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileQuestion, LayoutDashboard } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center bg-background relative overflow-hidden animate-in fade-in duration-500">
      {/* Background ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md bg-card/80 backdrop-blur-xl border border-border/40 shadow-soft rounded-[2.5rem] p-8 sm:p-10 flex flex-col items-center">
        <div className="rounded-3xl bg-primary/10 p-5 mb-6 text-primary shadow-inner">
          <FileQuestion className="size-10" />
        </div>

        <span className="text-xs font-extrabold uppercase tracking-widest text-primary bg-primary/10 px-3.5 py-1 rounded-full mb-3">
          Error 404
        </span>

        <h1 className="text-3xl font-extrabold tracking-tight text-foreground mb-2">
          Page Not Found
        </h1>

        <p className="text-sm font-medium text-muted-foreground leading-relaxed mb-8">
          The page or clinical file you are looking for does not exist or has been relocated.
        </p>

        <Link href="/dashboard" className="w-full">
          <Button className="w-full h-12 text-base font-bold rounded-xl gradient-primary border-0 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">
            <LayoutDashboard className="mr-2 size-5" /> Return to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}