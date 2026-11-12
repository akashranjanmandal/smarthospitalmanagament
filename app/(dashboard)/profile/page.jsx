import { ensureUser } from "@/lib/auth";
import { getRoleLabel } from "@/lib/roles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Mail, Phone, MapPin, Calendar, Shield, IdCard, HeartPulse, Stethoscope, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";

import { EditProfileDialog } from "@/components/profile/edit-profile-dialog";

export default async function ProfilePage() {
  let user = null;

  try {
    user = await ensureUser();
  } catch (e) {
    console.error("Profile load error:", e.message);
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 animate-in fade-in duration-500">
        <Card className="shadow-soft border-border/40 rounded-3xl overflow-hidden">
          <CardContent className="p-12 text-center flex flex-col items-center">
            <div className="bg-muted p-4 rounded-full mb-4">
              <AlertCircle className="size-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">Authentication Error</h2>
            <p className="text-muted-foreground font-medium">You are not currently signed in.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const initials = `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase() || "U";

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">My Profile</h1>
          <p className="text-lg font-medium text-muted-foreground">Manage your account settings and personal information</p>
        </div>
        <EditProfileDialog user={user} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr] items-start">
        
        {/* Left Column - Main Identity Card */}
        <Card className="shadow-soft border-border/40 bg-card rounded-3xl overflow-hidden relative">
          {/* Banner Background */}
          <div className="h-32 w-full bg-gradient-to-r from-primary via-primary/80 to-accent absolute top-0 left-0" />
          
          <CardContent className="flex flex-col items-center p-6 pt-16 text-center relative z-10">
            <Avatar className="size-28 mb-5 border-4 border-card shadow-xl ring-1 ring-border/50 bg-card">
              <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-4xl font-extrabold">
                {initials}
              </AvatarFallback>
            </Avatar>
            
            <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
              {user.firstName} {user.lastName}
            </h2>
            
            <Badge className="mt-3 px-4 py-1.5 font-extrabold tracking-wider shadow-none border-0 bg-primary/10 text-primary hover:bg-primary/20 uppercase text-xs">
              {getRoleLabel(user.role)}
            </Badge>

            <div className="w-full space-y-4 text-left mt-8 bg-muted/30 p-5 rounded-2xl border border-border/50">
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 bg-background rounded-xl shadow-sm text-muted-foreground"><Mail className="size-4" /></div>
                <span className="font-bold text-sm truncate">
                  {user.email && !user.email.endsWith("@phone.local") ? user.email : "Not Provided"}
                </span>
              </div>
              {user.phone && (
                <div className="flex items-center gap-3.5">
                  <div className="p-2.5 bg-background rounded-xl shadow-sm text-muted-foreground"><Phone className="size-4" /></div>
                  <span className="font-bold text-sm">+91 {user.phone}</span>
                </div>
              )}
              {user.city && (
                <div className="flex items-center gap-3.5">
                  <div className="p-2.5 bg-background rounded-xl shadow-sm text-muted-foreground"><MapPin className="size-4" /></div>
                  <span className="font-bold text-sm">{user.city}</span>
                </div>
              )}
              <div className="flex items-center gap-3.5 mt-4 pt-4 border-t border-border/60">
                <div className="p-2.5 bg-background rounded-xl shadow-sm text-muted-foreground"><IdCard className="size-4" /></div>
                <div>
                  <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Account ID</span>
                  <span className="font-mono text-xs font-bold">{user.employeeId || user.id.slice(0, 12)}</span>
                </div>
              </div>
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 bg-background rounded-xl shadow-sm text-muted-foreground"><Calendar className="size-4" /></div>
                <div>
                  <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Member Since</span>
                  <span className="font-bold text-sm">{new Date(user.createdAt).toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right Column - Role Specific & Account Details */}
        <div className="space-y-6">
          
          {user.patient && (
            <Card className="shadow-soft border-teal-200 dark:border-teal-900/50 bg-teal-50/30 dark:bg-teal-900/10 rounded-3xl overflow-hidden">
              <CardHeader className="bg-teal-100/50 dark:bg-teal-900/30 border-b border-teal-200/50 dark:border-teal-800 pb-4">
                <CardTitle className="text-lg font-bold flex items-center gap-3 text-teal-800 dark:text-teal-400">
                  <div className="p-2 bg-teal-600 text-white rounded-xl shadow-sm"><HeartPulse className="size-4" /></div>
                  Clinical Patient Details
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="bg-background rounded-2xl p-4 border border-teal-200/50 dark:border-teal-800/50 shadow-sm">
                    <span className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Gender</span>
                    <span className="font-extrabold text-foreground">{user.patient.gender}</span>
                  </div>
                  <div className="bg-background rounded-2xl p-4 border border-teal-200/50 dark:border-teal-800/50 shadow-sm">
                    <span className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Date of Birth</span>
                    <span className="font-extrabold text-foreground">{new Date(user.patient.dateOfBirth).toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  </div>
                  <div className="bg-background rounded-2xl p-4 border border-teal-200/50 dark:border-teal-800/50 shadow-sm">
                    <span className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Blood Group</span>
                    <span className="font-extrabold text-red-600 dark:text-red-400">{user.patient.bloodGroup || "Not Provided"}</span>
                  </div>
                  <div className="bg-background rounded-2xl p-4 border border-teal-200/50 dark:border-teal-800/50 shadow-sm">
                    <span className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Emergency Contact</span>
                    <span className="font-extrabold text-foreground">{user.patient.emergencyContact || "Not Provided"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {user.doctor && (
            <Card className="shadow-soft border-blue-200 dark:border-blue-900/50 bg-blue-50/30 dark:bg-blue-900/10 rounded-3xl overflow-hidden">
              <CardHeader className="bg-blue-100/50 dark:bg-blue-900/30 border-b border-blue-200/50 dark:border-blue-800 pb-4">
                <CardTitle className="text-lg font-bold flex items-center gap-3 text-blue-800 dark:text-blue-400">
                  <div className="p-2 bg-blue-600 text-white rounded-xl shadow-sm"><Stethoscope className="size-4" /></div>
                  Professional Doctor Details
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="bg-background rounded-2xl p-4 border border-blue-200/50 dark:border-blue-800/50 shadow-sm">
                    <span className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Department</span>
                    <span className="font-extrabold text-foreground">{user.doctor.department?.name || "—"}</span>
                  </div>
                  <div className="bg-background rounded-2xl p-4 border border-blue-200/50 dark:border-blue-800/50 shadow-sm">
                    <span className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Specialization</span>
                    <span className="font-extrabold text-foreground line-clamp-1">{user.doctor.specialization || "—"}</span>
                  </div>
                  <div className="bg-background rounded-2xl p-4 border border-blue-200/50 dark:border-blue-800/50 shadow-sm">
                    <span className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Qualification</span>
                    <span className="font-extrabold text-foreground line-clamp-1">{user.doctor.qualification || "—"}</span>
                  </div>
                  <div className="bg-background rounded-2xl p-4 border border-blue-200/50 dark:border-blue-800/50 shadow-sm">
                    <span className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Experience</span>
                    <span className="font-extrabold text-foreground">{user.doctor.experience || 0} years</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="shadow-soft border-border/40 bg-card rounded-3xl overflow-hidden">
            <CardHeader className="bg-muted/20 border-b border-border/30 pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-3">
                <div className="p-2 bg-primary/10 text-primary rounded-xl"><Shield className="size-4" /></div>
                Security & Account Status
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-border/50 bg-background">
                <div>
                  <p className="font-bold text-foreground">Profile Completion</p>
                  <p className="text-sm font-medium text-muted-foreground mt-0.5">
                    {user.profileComplete ? "Your profile is fully setup and verified." : "Missing required information."}
                  </p>
                </div>
                {user.profileComplete ? (
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 font-bold px-3 py-1 shadow-none border-0 w-fit">
                    <CheckCircle2 className="mr-1.5 size-3.5" /> Fully Complete
                  </Badge>
                ) : (
                  <Link href="/complete-profile">
                    <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 hover:bg-amber-200 font-bold px-4 py-1.5 shadow-none border-0 cursor-pointer transition-colors w-fit">
                      Action Required →
                    </Badge>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
          
        </div>
      </div>
    </div>
  );
}