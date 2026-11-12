import { Figtree, Noto_Sans_Devanagari } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// Figtree for clear, friendly reading at every size; Noto Sans Devanagari so Hindi renders properly.
const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree", display: "swap" });
const devanagari = Noto_Sans_Devanagari({ subsets: ["devanagari"], variable: "--font-devanagari", weight: ["400", "600"], display: "swap" });

export const metadata = {
  title: process.env.NEXT_PUBLIC_HOSPITAL_NAME || "Smart Hospital",
  description: "Hospital management system for staff and patients",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${figtree.variable} ${devanagari.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background font-sans selection:bg-primary/20 selection:text-primary relative">
        <TooltipProvider>
          {children}
          <Toaster position="top-right" richColors />
        </TooltipProvider>
      </body>
    </html>
  );
}