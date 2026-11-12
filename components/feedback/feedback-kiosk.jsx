"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { ComplaintForm } from "./complaint-form";
import { TicketTracker } from "./ticket-tracker";
import { MessageSquarePlus, SearchCheck, Sparkles, Clock, CheckCircle } from "lucide-react";

export function FeedbackKiosk({ departments }) {
  const [activeTab, setActiveTab] = useState("submit");
  const [trackedTicket, setTrackedTicket] = useState("");

  const handleTrackTicket = (ticketNumber) => {
    setTrackedTicket(ticketNumber);
    setActiveTab("track");
  };

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="text-center space-y-3 max-w-2xl mx-auto pb-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Patient Grievance Redressal & Accountability Engine</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
          Your Voice Drives Our Care
        </h1>
        <p className="text-base text-muted-foreground">
          Submit feedback or complaints directly to the concerned Department Head. Unresolved issues automatically escalate to Hospital Administrators.
        </p>
      </div>

      {/* Feature Pills */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl bg-card border shadow-xs flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600">
            <MessageSquarePlus className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold">Category-Tagged</h4>
            <p className="text-sm text-muted-foreground">Auto-routed to Dept Head</p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-card border shadow-xs flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold">12h to 72h SLA Matrix</h4>
            <p className="text-sm text-muted-foreground">Rule-based escalation timers</p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-card border shadow-xs flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600">
            <CheckCircle className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold">Anonymous Tracking</h4>
            <p className="text-sm text-muted-foreground">Track with unique ticket code</p>
          </div>
        </div>
      </div>

      {/* Main Tabs Card */}
      <Card className="border shadow-soft overflow-hidden">
        <CardContent className="p-3 sm:p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid grid-cols-1 sm:grid-cols-2 w-full max-w-md mx-auto h-auto min-h-12 p-1 gap-1">
              <TabsTrigger value="submit" className="gap-2 font-bold text-base h-auto min-h-10 py-2 whitespace-normal text-center leading-tight">
                <MessageSquarePlus className="h-4 w-4" />
                Submit Grievance
              </TabsTrigger>
              <TabsTrigger value="track" className="gap-2 font-bold text-base h-auto min-h-10 py-2 whitespace-normal text-center leading-tight">
                <SearchCheck className="h-4 w-4" />
                Track Ticket Status
              </TabsTrigger>
            </TabsList>

            <TabsContent value="submit" className="pt-2">
              <ComplaintForm
                departments={departments}
                onTrackTicket={handleTrackTicket}
              />
            </TabsContent>

            <TabsContent value="track" className="pt-2">
              <TicketTracker initialCode={trackedTicket} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
