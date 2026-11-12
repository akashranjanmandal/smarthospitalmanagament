"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateUserProfile } from "@/actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { FormSelect } from "@/components/shared/form-select";
import { Pencil, Loader2, Save, User, Mail, MapPin, CalendarDays, HeartPulse, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export function EditProfileDialog({ user, onUpdated }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const initialEmail = user.email && !user.email.endsWith("@phone.local") ? user.email : "";
  const patient = user.patient || {};

  const [form, setForm] = useState({
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    email: initialEmail,
    city: user.city || patient.address || "",
    gender: patient.gender || "MALE",
    dateOfBirth: patient.dateOfBirth
      ? new Date(patient.dateOfBirth).toISOString().split("T")[0]
      : "",
    bloodGroup: patient.bloodGroup || "",
    emergencyContact: patient.emergencyContact || "",
  });

  const setField = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.firstName.trim()) {
      toast.error("First name is required");
      return;
    }

    setLoading(true);
    const res = await updateUserProfile(form);
    setLoading(false);

    if (res.success) {
      toast.success(res.message);
      setOpen(false);
      if (onUpdated) onUpdated(res.data);
      if (typeof window !== "undefined") {
        window.location.reload();
      } else {
        router.refresh();
      }
    } else {
      toast.error(res.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className="rounded-xl shadow-md gradient-primary border-0 text-white font-bold px-5 py-2.5 hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer">
            <Pencil className="mr-2 size-4" /> Edit Profile
          </Button>
        }
      />

      <DialogContent className="max-w-xl rounded-3xl p-0 overflow-hidden shadow-2xl border-border/40">
        {/* Header */}
        <div className="gradient-primary p-6 text-white relative">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold text-white flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20">
                <Pencil className="size-5 text-cyan-100" />
              </div>
              Update Account & Personal Information
            </DialogTitle>
            <DialogDescription className="text-cyan-100/80 text-xs font-medium mt-1">
              Modify your personal profile details below. Changes will be saved to your account.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="font-semibold text-xs">First Name *</Label>
              <Input
                value={form.firstName}
                onChange={(e) => setField("firstName", e.target.value)}
                placeholder="First name"
                className="rounded-xl h-11"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-semibold text-xs">Last Name</Label>
              <Input
                value={form.lastName}
                onChange={(e) => setField("lastName", e.target.value)}
                placeholder="Last name"
                className="rounded-xl h-11"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 font-semibold text-xs">
                <Mail className="size-3.5 text-primary" /> Email Address
              </Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                placeholder="name@example.com"
                className="rounded-xl h-11"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 font-semibold text-xs">
                <MapPin className="size-3.5 text-primary" /> City / Location
              </Label>
              <Input
                value={form.city}
                onChange={(e) => setField("city", e.target.value)}
                placeholder="e.g. Mumbai"
                className="rounded-xl h-11"
              />
            </div>
          </div>

          {user.role === "PATIENT" && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="font-semibold text-xs">Gender</Label>
                  <FormSelect
                    options={[
                      { value: "MALE", label: "Male" },
                      { value: "FEMALE", label: "Female" },
                      { value: "OTHER", label: "Other" },
                    ]}
                    value={form.gender}
                    onValueChange={(v) => setField("gender", v)}
                    placeholder="Select gender"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 font-semibold text-xs">
                    <CalendarDays className="size-3.5 text-primary" /> Date of Birth
                  </Label>
                  <Input
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(e) => setField("dateOfBirth", e.target.value)}
                    className="rounded-xl h-11"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 font-semibold text-xs">
                    <HeartPulse className="size-3.5 text-primary" /> Blood Group
                  </Label>
                  <FormSelect
                    options={["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((g) => ({
                      value: g,
                      label: g,
                    }))}
                    value={form.bloodGroup}
                    onValueChange={(v) => setField("bloodGroup", v)}
                    placeholder="Select blood group"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 font-semibold text-xs">
                    <ShieldAlert className="size-3.5 text-primary" /> Emergency Contact
                  </Label>
                  <Input
                    value={form.emergencyContact}
                    onChange={(e) => setField("emergencyContact", e.target.value)}
                    placeholder="Name / Phone Number"
                    className="rounded-xl h-11"
                  />
                </div>
              </div>
            </>
          )}

          <DialogFooter className="pt-3 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="rounded-xl font-bold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="rounded-xl font-bold gradient-primary text-white border-0 shadow-md"
            >
              {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
