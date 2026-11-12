"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createWard, createBed } from "@/actions/beds";
import { BED_TYPE_LABELS, BED_STATUS_LABELS } from "@/lib/constants";
import { toast } from "sonner";
import { Building2, BedDouble, Plus, Loader2 } from "lucide-react";

export function CreateBedDialog({ open, onOpenChange, wards = [], departments = [], onCreated }) {
  const [mode, setMode] = useState("ward"); // 'ward' | 'bed'
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Ward Form State
  const [wardName, setWardName] = useState("");
  const [floor, setFloor] = useState(1);
  const [deptId, setDeptId] = useState("");
  const [genderWard, setGenderWard] = useState("MIXED");

  // Bed Form State
  const [selectedWardId, setSelectedWardId] = useState("");
  const [bedNumber, setBedNumber] = useState("");
  const [bedType, setBedType] = useState("GENERAL");
  const [initialStatus, setInitialStatus] = useState("VACANT");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (departments.length > 0 && !deptId) {
      setDeptId(departments[0].id);
    }
  }, [departments, deptId]);

  useEffect(() => {
    if (wards.length > 0 && !selectedWardId) {
      setSelectedWardId(wards[0].id);
    }
  }, [wards, selectedWardId]);

  const handleCreateWard = async (e) => {
    e.preventDefault();
    if (!wardName.trim()) {
      toast.error("Please enter a ward name");
      return;
    }
    if (!deptId) {
      toast.error("Please select a department");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createWard({
        name: wardName.trim(),
        floor: Number(floor),
        departmentId: deptId,
        genderWard,
      });

      if (res.success) {
        toast.success("Ward created successfully");
        setWardName("");
        if (onCreated) onCreated();
        onOpenChange(false);
      } else {
        toast.error(res.message || "Failed to create ward");
      }
    } catch {
      toast.error("Error creating ward");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateBed = async (e) => {
    e.preventDefault();
    if (!bedNumber.trim()) {
      toast.error("Please enter a bed number (e.g. A01)");
      return;
    }
    if (!selectedWardId) {
      toast.error("Please select a ward");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createBed({
        bedNumber: bedNumber.trim(),
        wardId: selectedWardId,
        bedType,
        status: initialStatus,
        notes,
      });

      if (res.success) {
        toast.success("Bed created successfully");
        setBedNumber("");
        setNotes("");
        if (onCreated) onCreated();
        onOpenChange(false);
      } else {
        toast.error(res.message || "Failed to create bed");
      }
    } catch {
      toast.error("Error creating bed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-3xl p-6 shadow-2xl border-border/40">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Add Ward or Bed
          </DialogTitle>
          <DialogDescription>
            Register new physical hospital wards and bed units for patient admissions.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={setMode} className="w-full space-y-5 mt-2">
          <TabsList className="grid grid-cols-2 w-full h-11 p-1 bg-muted/60 rounded-xl">
            <TabsTrigger value="ward" className="gap-2 font-bold text-xs rounded-lg">
              <Building2 className="h-4 w-4" />
              1. Add Ward
            </TabsTrigger>
            <TabsTrigger value="bed" disabled={wards.length === 0} className="gap-2 font-bold text-xs rounded-lg">
              <BedDouble className="h-4 w-4" />
              2. Add Bed
            </TabsTrigger>
          </TabsList>

          {/* Form 1: Create Ward */}
          <TabsContent value="ward">
            <form onSubmit={handleCreateWard} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="wname" className="text-xs font-bold">Ward Name</Label>
                <Input
                  id="wname"
                  placeholder="e.g. Cardiology Ward A"
                  value={wardName}
                  onChange={(e) => setWardName(e.target.value)}
                  className="h-10 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="floor" className="text-xs font-bold">Floor Number</Label>
                  <Input
                    id="floor"
                    type="number"
                    min={1}
                    max={10}
                    value={floor}
                    onChange={(e) => setFloor(e.target.value)}
                    className="h-10 rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Gender Allocation</Label>
                  <Select value={genderWard} onValueChange={setGenderWard}>
                    <SelectTrigger className="h-10 rounded-xl">
                      <SelectValue placeholder="Gender">
                        {genderWard === "MIXED" ? "Mixed / Unisex" : genderWard === "MALE" ? "Male Ward" : "Female Ward"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MIXED" label="Mixed / Unisex">Mixed / Unisex</SelectItem>
                      <SelectItem value="MALE" label="Male Ward">Male Ward</SelectItem>
                      <SelectItem value="FEMALE" label="Female Ward">Female Ward</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Associated Department</Label>
                <Select value={deptId} onValueChange={setDeptId}>
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue placeholder="Select Department">
                      {departments.find((d) => d.id === deptId)?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id} label={d.name}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter className="pt-3">
                <Button type="submit" disabled={isSubmitting} className="w-full font-bold h-11 rounded-xl gap-2">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Create Ward
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          {/* Form 2: Create Bed */}
          <TabsContent value="bed">
            <form onSubmit={handleCreateBed} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Target Ward</Label>
                <Select value={selectedWardId} onValueChange={setSelectedWardId}>
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue placeholder="Select Ward">
                      {wards.find((w) => w.id === selectedWardId)?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {wards.map((w) => (
                      <SelectItem key={w.id} value={w.id} label={`${w.name} (Floor ${w.floor})`}>
                        {w.name} (Floor {w.floor})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="bnum" className="text-xs font-bold">Bed Number</Label>
                  <Input
                    id="bnum"
                    placeholder="e.g. A01"
                    value={bedNumber}
                    onChange={(e) => setBedNumber(e.target.value)}
                    className="h-10 rounded-xl font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Bed Type</Label>
                  <Select value={bedType} onValueChange={setBedType}>
                    <SelectTrigger className="h-10 rounded-xl">
                      <SelectValue placeholder="Bed Type">
                        {BED_TYPE_LABELS[bedType] || bedType}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(BED_TYPE_LABELS).map(([k, l]) => (
                        <SelectItem key={k} value={k} label={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Initial Status</Label>
                <Select value={initialStatus} onValueChange={setInitialStatus}>
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue placeholder="Status">
                      {BED_STATUS_LABELS[initialStatus] || initialStatus}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(BED_STATUS_LABELS).map(([k, l]) => (
                      <SelectItem key={k} value={k} label={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter className="pt-3">
                <Button type="submit" disabled={isSubmitting} className="w-full font-bold h-11 rounded-xl gap-2">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Add Bed Unit
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
