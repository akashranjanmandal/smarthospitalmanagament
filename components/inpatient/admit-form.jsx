"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { admitPatient, searchAdmittablePatients } from "@/actions/admissions";
import { setPayer } from "@/actions/insurance";
import { PayerForm } from "@/components/inpatient/insurance-panel";
import { Panel } from "@/components/inpatient/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BED_STATUS_LABELS, BED_TYPE_LABELS } from "@/lib/constants";
import { Loader2, UserPlus } from "lucide-react";

const fullName = (p) => `${p.firstName} ${p.lastName}`.trim();

export function AdmitForm({ options, initialBedId, initialPatientId, canSetPayer = false }) {
  const router = useRouter();
  const { beds, patients, departments, doctors } = options;
  const startBed = beds.find((b) => b.id === initialBedId);
  const startPatient = patients.find((p) => p.id === initialPatientId);

  const [patientQuery, setPatientQuery] = useState("");
  const [patientId, setPatientId] = useState(startPatient?.id ?? "");
  // The picker is filled by live search instead of one eagerly-loaded list of every patient
  // (that doesn't scale past a few hundred patients); it starts with just the deep-linked one, if any.
  const [searchResults, setSearchResults] = useState(startPatient ? [startPatient] : []);
  const [searching, setSearching] = useState(false);
  const [bedId, setBedId] = useState(startBed?.id ?? "");
  const [departmentId, setDepartmentId] = useState(startBed?.ward.departmentId ?? "");
  const [doctorId, setDoctorId] = useState("");
  const [reason, setReason] = useState("");
  const [provisionalDiagnosis, setProvisionalDiagnosis] = useState("");
  const [saving, setSaving] = useState(false);
  const [payer, setPayerDraft] = useState({ payerType: "SELF" });

  useEffect(() => {
    const q = patientQuery.trim();
    if (q.length < 2) return;
    setSearching(true);
    const timer = setTimeout(async () => {
      const res = await searchAdmittablePatients(q);
      if (res.success) setSearchResults(res.data);
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [patientQuery]);

  const matchingPatients = useMemo(() => {
    // Keep the chosen patient selectable even once a new search no longer returns them.
    const chosen = patients.find((p) => p.id === patientId) ?? searchResults.find((p) => p.id === patientId);
    return chosen && !searchResults.some((p) => p.id === chosen.id) ? [chosen, ...searchResults] : searchResults;
  }, [patients, searchResults, patientId]);

  const departmentDoctors = doctors.filter((d) => d.departmentId === departmentId);

  const chooseBed = (id) => {
    setBedId(id);
    const bed = beds.find((b) => b.id === id);
    // Default the department to the ward's own department the first time
    if (bed && !departmentId) setDepartmentId(bed.ward.departmentId);
  };

  const chooseDepartment = (id) => {
    setDepartmentId(id);
    if (!doctors.some((d) => d.id === doctorId && d.departmentId === id)) setDoctorId("");
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const res = await admitPatient({ patientId, bedId, departmentId, doctorId, reason, provisionalDiagnosis });
    setSaving(false);
    if (!res.success) return toast.error(res.message);
    toast.success(res.message);
    if (canSetPayer && payer.payerType !== "SELF") {
      const p = await setPayer(res.data.id, payer);
      if (!p.success) toast.warning(`Admitted, but payer details were not saved: ${p.message}. Fix them in the Insurance tab.`);
    }
    router.push(`/admissions/${res.data.id}`);
    router.refresh();
  };

  const wardsWithBeds = beds.reduce((acc, b) => {
    (acc[b.ward.name] ??= []).push(b);
    return acc;
  }, {});

  return (
    <form onSubmit={submit} className="space-y-4">
      <Panel
        title="1. Patient"
        action={
          <Link href="/patients/new" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
            <UserPlus className="size-3.5" /> Register new patient
          </Link>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="patient-search">Find patient</Label>
            <Input id="patient-search" value={patientQuery} onChange={(e) => setPatientQuery(e.target.value)} placeholder="Name, UHID or phone (at least 2 letters)" className="h-10 rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admit-patient">Patient</Label>
            <Select value={patientId} onValueChange={setPatientId}>
              <SelectTrigger id="admit-patient" className="h-10 w-full rounded-lg">
                <SelectValue placeholder={searching ? "Searching…" : matchingPatients.length ? `${matchingPatients.length} matching patients` : "Type above to search"} />
              </SelectTrigger>
              <SelectContent>
                {matchingPatients.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{fullName(p)} — {p.uhid}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Patients already admitted are not listed.</p>
          </div>
        </div>
      </Panel>

      <Panel title="2. Bed">
        <div className="space-y-1.5">
          <Label htmlFor="admit-bed">Bed</Label>
          <Select value={bedId} onValueChange={chooseBed}>
            <SelectTrigger id="admit-bed" className="h-10 w-full rounded-lg">
              <SelectValue placeholder={beds.length ? `Select from ${beds.length} available beds` : "No vacant beds"} />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(wardsWithBeds).map(([ward, list]) =>
                list.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.bedNumber} · {ward} (Floor {b.ward.floor}) · {BED_TYPE_LABELS[b.bedType]}{b.status !== "VACANT" ? ` · ${BED_STATUS_LABELS[b.status]}` : ""}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </Panel>

      <Panel title="3. Clinical team">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="admit-department">Admitting department</Label>
            <Select value={departmentId} onValueChange={chooseDepartment}>
              <SelectTrigger id="admit-department" className="h-10 w-full rounded-lg">
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admit-doctor">Attending doctor</Label>
            <Select value={doctorId} onValueChange={setDoctorId} disabled={!departmentId}>
              <SelectTrigger id="admit-doctor" className="h-10 w-full rounded-lg">
                <SelectValue placeholder={departmentId ? "Select doctor" : "Select department first"} />
              </SelectTrigger>
              <SelectContent>
                {departmentDoctors.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">No doctors in this department</div>
                ) : (
                  departmentDoctors.map((d) => <SelectItem key={d.id} value={d.id}>Dr. {d.firstName} {d.lastName}{d.specialization ? ` · ${d.specialization}` : ""}</SelectItem>)
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Panel>

      <Panel title="4. Reason for admission">
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="admit-reason">Reason / chief complaint</Label>
            <Textarea id="admit-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. High fever for 4 days, vomiting" className="min-h-20 rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admit-dx">Provisional diagnosis (optional)</Label>
            <Input id="admit-dx" value={provisionalDiagnosis} onChange={(e) => setProvisionalDiagnosis(e.target.value)} placeholder="e.g. Dengue fever" className="h-10 rounded-lg" />
          </div>
        </div>
      </Panel>

      {canSetPayer && (
        <Panel title="5. Payment">
          <PayerForm compact canEdit onChange={setPayerDraft} />
          <p className="mt-2 text-xs text-muted-foreground">For insured and scheme patients the insurance desk will request pre-authorisation. Collect an advance deposit from self-paying patients in the Billing tab.</p>
        </Panel>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" className="rounded-lg" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" className="gap-2 rounded-lg" disabled={saving}>
          {saving && <Loader2 className="size-4 animate-spin" />} Admit patient
        </Button>
      </div>
    </form>
  );
}
