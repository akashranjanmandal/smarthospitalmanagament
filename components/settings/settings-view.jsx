"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  User,
  Building2,
  Bell,
  ShieldCheck,
  Palette,
  Save,
  Loader2,
  CheckCircle2,
  Lock,
  Mail,
  Phone,
  MapPin,
  Clock,
  IndianRupee,
  Sparkles,
} from "lucide-react";

export function SettingsView({ user }) {
  const [activeTab, setActiveTab] = useState("general");
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [email] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [city, setCity] = useState(user?.city || "");

  // System Settings State
  const [hospitalName, setHospitalName] = useState("Smart Hospital System (SHDS)");
  const [currency] = useState("INR");
  const [timezone] = useState("Asia/Kolkata");

  // Notifications State
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(true);
  const [slaEscalations, setSlaEscalations] = useState(true);

  // Security State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSaveGeneral = (e) => {
    e.preventDefault();
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      toast.success("Account settings updated successfully!");
    }, 600);
  };

  const handleSaveSystem = (e) => {
    e.preventDefault();
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      toast.success("Hospital system configuration updated!");
    }, 600);
  };

  const handleSavePassword = (e) => {
    e.preventDefault();
    if (newPassword && newPassword !== confirmPassword) {
      toast.error("New passwords do not match!");
      return;
    }
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Security credentials updated!");
    }, 600);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
          <Building2 className="h-7 w-7 text-primary" />
          Settings & System Preferences
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Manage your account profile, hospital configuration, SLA parameters, and notification alerts.
        </p>
      </div>

      {/* Main Tabs Layout */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full h-12 p-1 bg-muted/60 rounded-2xl">
          <TabsTrigger value="general" className="gap-2 font-bold text-xs sm:text-sm h-10 rounded-xl">
            <User className="h-4 w-4" />
            General Profile
          </TabsTrigger>
          <TabsTrigger value="system" className="gap-2 font-bold text-xs sm:text-sm h-10 rounded-xl">
            <Building2 className="h-4 w-4" />
            Hospital Config
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2 font-bold text-xs sm:text-sm h-10 rounded-xl">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2 font-bold text-xs sm:text-sm h-10 rounded-xl">
            <ShieldCheck className="h-4 w-4" />
            Security & Auth
          </TabsTrigger>
        </TabsList>

        {/* 1. General Profile Tab */}
        <TabsContent value="general">
          <form onSubmit={handleSaveGeneral}>
            <Card className="border shadow-soft rounded-3xl overflow-hidden">
              <CardHeader className="bg-muted/20 border-b border-border/40 p-5 sm:p-6">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  Personal Information
                </CardTitle>
                <CardDescription>
                  Update your contact details and user identification.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="flex items-center gap-4 p-4 rounded-2xl bg-muted/30 border">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-accent text-white font-extrabold text-lg flex items-center justify-center shadow-md">
                    {user?.firstName?.[0]}{user?.lastName?.[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base text-foreground">
                        {user?.firstName} {user?.lastName}
                      </span>
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs font-bold">
                        {user?.role}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground block mt-0.5">
                      Account ID: {user?.employeeId || user?.id?.slice(0, 12)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="font-semibold text-xs">First Name</Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="font-semibold text-xs">Last Name</Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="h-11 rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="font-semibold text-xs">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        value={email}
                        disabled
                        className="pl-9 h-11 rounded-xl bg-muted/50 text-muted-foreground"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="font-semibold text-xs">Phone Number</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+91 98765 43210"
                        className="pl-9 h-11 rounded-xl"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city" className="font-semibold text-xs">City / Branch Location</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Kolkata, West Bengal"
                      className="pl-9 h-11 rounded-xl"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="submit" disabled={isSaving} className="gap-2 font-bold h-11 rounded-xl px-6">
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Profile Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </TabsContent>

        {/* 2. Hospital Config Tab */}
        <TabsContent value="system">
          <form onSubmit={handleSaveSystem}>
            <Card className="border shadow-soft rounded-3xl overflow-hidden">
              <CardHeader className="bg-muted/20 border-b border-border/40 p-5 sm:p-6">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  Hospital System Parameters
                </CardTitle>
                <CardDescription>
                  Configure system branding, currency format, and default operating options.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="hname" className="font-semibold text-xs">Hospital System Name</Label>
                  <Input
                    id="hname"
                    value={hospitalName}
                    onChange={(e) => setHospitalName(e.target.value)}
                    className="h-11 rounded-xl font-medium"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-semibold text-xs">Currency Standard</Label>
                    <div className="flex items-center gap-2 p-3 rounded-xl border bg-muted/20 font-bold text-sm">
                      <IndianRupee className="h-4 w-4 text-primary" />
                      <span>INR (₹ - Indian Rupee)</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-semibold text-xs">System Timezone</Label>
                    <div className="flex items-center gap-2 p-3 rounded-xl border bg-muted/20 font-bold text-sm">
                      <Clock className="h-4 w-4 text-primary" />
                      <span>IST (UTC+05:30) Asia/Kolkata</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 space-y-2">
                  <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-bold text-sm">
                    <Sparkles className="h-4 w-4 text-blue-600" />
                    Automated SLA Escalation Rules
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-blue-800 dark:text-blue-200 pt-1">
                    <div className="p-2.5 rounded-lg bg-background border">
                      <span className="font-bold block">Level 1 (Dept Head)</span>
                      <span>Target: 48 hours</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-background border">
                      <span className="font-bold block">Level 2 (Admin)</span>
                      <span>Target: 24 hours</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-background border">
                      <span className="font-bold block">Level 3 (Director)</span>
                      <span>Target: 12 hours</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="submit" disabled={isSaving} className="gap-2 font-bold h-11 rounded-xl px-6">
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Hospital Config
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </TabsContent>

        {/* 3. Notifications Tab */}
        <TabsContent value="notifications">
          <Card className="border shadow-soft rounded-3xl overflow-hidden">
            <CardHeader className="bg-muted/20 border-b border-border/40 p-5 sm:p-6">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Notification & Alert Channels
              </CardTitle>
              <CardDescription>
                Choose how you receive grievance alerts, appointment updates, and system events.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-2xl border bg-muted/10">
                  <div className="space-y-0.5">
                    <span className="font-bold text-sm block">SLA Escalation Alerts</span>
                    <span className="text-xs text-muted-foreground">Receive real-time notifications when a ticket breaches deadline.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={slaEscalations}
                    onChange={(e) => {
                      setSlaEscalations(e.target.checked);
                      toast.success(`SLA alerts ${e.target.checked ? "enabled" : "disabled"}`);
                    }}
                    className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl border bg-muted/10">
                  <div className="space-y-0.5">
                    <span className="font-bold text-sm block">Email Dispatch Notifications</span>
                    <span className="text-xs text-muted-foreground">Send ticket confirmations and medical records to patients via Resend.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={emailAlerts}
                    onChange={(e) => {
                      setEmailAlerts(e.target.checked);
                      toast.success(`Email alerts ${e.target.checked ? "enabled" : "disabled"}`);
                    }}
                    className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl border bg-muted/10">
                  <div className="space-y-0.5">
                    <span className="font-bold text-sm block">SMS & OTP Alerts</span>
                    <span className="text-xs text-muted-foreground">Enable phone OTP verification and appointment reminders via SMS.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={smsAlerts}
                    onChange={(e) => {
                      setSmsAlerts(e.target.checked);
                      toast.success(`SMS alerts ${e.target.checked ? "enabled" : "disabled"}`);
                    }}
                    className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 4. Security & Auth Tab */}
        <TabsContent value="security">
          <form onSubmit={handleSavePassword}>
            <Card className="border shadow-soft rounded-3xl overflow-hidden">
              <CardHeader className="bg-muted/20 border-b border-border/40 p-5 sm:p-6">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  Security Credentials & Access
                </CardTitle>
                <CardDescription>
                  Update your password and view active authentication security parameters.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-4 max-w-md">
                  <div className="space-y-2">
                    <Label htmlFor="cpass" className="font-semibold text-xs">Current Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="cpass"
                        type="password"
                        placeholder="••••••••"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="pl-9 h-11 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="npass" className="font-semibold text-xs">New Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="npass"
                        type="password"
                        placeholder="••••••••"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="pl-9 h-11 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confpass" className="font-semibold text-xs">Confirm New Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confpass"
                        type="password"
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pl-9 h-11 rounded-xl"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="submit" disabled={isSaving} className="gap-2 font-bold h-11 rounded-xl px-6">
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Update Password
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}
