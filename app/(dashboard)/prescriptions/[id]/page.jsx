"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { getPrescriptionById } from "@/actions/prescriptions";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format, differenceInYears } from "date-fns";
import {
  Loader2,
  Printer,
  ArrowLeft,
  Activity,
  ShieldCheck,
} from "lucide-react";
import { PageLoader } from "@/components/shared/page-loader";

export default function PrescriptionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [prescription, setPrescription] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPrescriptionById(params.id).then((result) => {
      if (result.success) setPrescription(result.data);
      else {
        toast.error(result.message);
        router.push("/prescriptions");
      }
      setLoading(false);
    });
  }, [params.id, router]);

  if (loading) {
    return (
      <PageLoader
        messages={[
          "Compiling the prescription sheet…",
          "Verifying medication records…",
          "Loading the prescription…",
          "Almost done…",
        ]}
      />
    );
  }

  if (!prescription) return null;

  const patient = prescription.medicalRecord?.patient;
  const doctor = prescription.doctor;
  const record = prescription.medicalRecord;
  const appointment = record?.appointment;

  const patientAge = patient?.dateOfBirth
    ? differenceInYears(new Date(), new Date(patient.dateOfBirth))
    : null;

  const formattedRxDate = format(new Date(prescription.createdAt), "dd/MM/yyyy");
  const formattedRxTime = format(new Date(prescription.createdAt), "hh:mm a");

  return (
    <div className="animate-in fade-in zoom-in-95 duration-500 max-w-5xl mx-auto space-y-4 print:m-0 print:space-y-0 print:p-0 print:max-w-none">
      {/* Print stylesheet to enforce single A4 page fit with zero cutoff */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 4mm 6mm;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-size: 10px !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-full-sheet {
            width: 100% !important;
            max-width: 100% !important;
            border: 1.5px solid #0f172a !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Screen-Only Header & Action Toolbar */}
      <div className="print:hidden">
        <PageHeader
          title="Prescription Sheet"
          description={`RX-${prescription.id.slice(0, 8).toUpperCase()}`}
          breadcrumbs={[{ label: "Prescriptions", href: "/prescriptions" }, { label: "Sheet" }]}
          onBack={() => router.back()}
        >
          <Button
            onClick={() => window.print()}
            className="w-full sm:w-auto rounded-xl shadow-md gradient-primary text-white border-0 font-bold hover:shadow-lg transition-all hover:-translate-y-0.5 px-5 h-11"
          >
            <Printer className="mr-2 size-4" /> Print Prescription (PDF)
          </Button>
        </PageHeader>
      </div>

      {/* Real Clinical Prescription Document */}
      <Card className="print-full-sheet shadow-2xl border-2 border-slate-300 dark:border-slate-800 bg-white text-slate-900 rounded-none overflow-hidden print:shadow-none print:border print:border-slate-900 print:m-0 print:p-0 font-sans">
        <CardContent className="p-5 sm:p-8 space-y-0 print:p-2.5">
          
          {/* ========================================================= */}
          {/* 1. TOP HOSPITAL LETTERHEAD BANNER */}
          {/* ========================================================= */}
          <div className="border-b-2 border-slate-900 pb-2 print:pb-1.5">
            {/* Accreditations Top Strip */}
            <div className="flex justify-between items-center text-[9.5px] uppercase font-bold tracking-wider text-slate-600 border-b border-slate-200 pb-0.5 mb-1.5 print:mb-1">
              <span className="bg-slate-900 text-white px-2 py-0.5 rounded font-black print:text-[8.5px]">
                ISO 9001:2015 CERTIFIED
              </span>
              <span className="flex items-center gap-1 text-primary font-bold print:text-black print:text-[8.5px]">
                <ShieldCheck className="size-3 text-primary print:text-black" /> NABH ACCREDITED HEALTHCARE PROVIDER
              </span>
            </div>

            {/* Hospital Brand & Name */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="size-11 sm:size-12 rounded-xl bg-gradient-to-br from-red-600 via-red-700 to-slate-900 text-white flex items-center justify-center shadow-md print:border print:border-slate-900 shrink-0">
                  <Activity className="size-6" />
                </div>
                <div>
                  <h1 className="text-lg sm:text-2xl font-black uppercase tracking-tight text-slate-900 leading-tight">
                    SMART HOSPITAL DIGITALIZATION SYSTEM
                  </h1>
                  <p className="text-[10.5px] font-bold text-slate-700 leading-tight">
                    (A Unit of Smart Healthcare & Digital Services Private Limited)
                  </p>
                  <p className="text-[9.5px] font-semibold text-slate-600 italic leading-tight">
                    A Multi Speciality Modern State-of-the-Art Hospital, Operated & Run By a Team of Dedicated Doctors
                  </p>
                </div>
              </div>
            </div>

            {/* Hospital Contact Info Bar */}
            <div className="mt-1.5 text-[9px] text-slate-600 font-medium leading-tight border-t border-slate-200 pt-1 flex flex-wrap justify-between gap-y-0.5">
              <span>
                <strong>Reg. Hospital:</strong> 1219 Health Park, Sector V, Salt Lake, Kolkata - 700 091
              </span>
              <span>
                <strong>Phone:</strong> (033) 7125 6666 / 2416-4122 | <strong>Helpline:</strong> 1800 123 101 666
              </span>
              <span>
                <strong>Email:</strong> care@smarthospital.org | <strong>Web:</strong> www.smarthospital.org
              </span>
            </div>
          </div>

          {/* ========================================================= */}
          {/* 2. DOCTOR & CONSULTATION BANNER */}
          {/* ========================================================= */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 py-2 border-b-2 border-slate-900 text-xs print:py-1.5 print:text-[10px]">
            <div>
              <h2 className="text-sm sm:text-base font-black uppercase text-slate-900 tracking-tight leading-tight">
                DR. {doctor.user.firstName} {doctor.user.lastName}
              </h2>
              <p className="font-bold text-slate-800 leading-tight">
                {doctor.qualification || "MBBS, MD"} (Reg. No. : {doctor.id.slice(-6).toUpperCase()})
              </p>
              <p className="font-semibold text-slate-700 leading-tight">
                {doctor.specialization || "Consultant Physician"}
              </p>
              <p className="font-bold text-primary print:text-slate-900 text-[10.5px] leading-tight">
                Department of {doctor.department?.name || "General Medicine"}
              </p>
            </div>
            <div className="md:text-right space-y-0.5">
              <p className="font-bold text-slate-800 leading-tight">
                <span className="text-slate-600 font-medium">Availability:</span> {doctor.available ? "OPD Schedule (Mon - Sat)" : "By Appointment"}
              </p>
              <p className="font-bold text-slate-800 leading-tight">
                <span className="text-slate-600 font-medium">Doctor Contact:</span> {doctor.phone || doctor.user.phone || "Hospital Helpdesk"}
              </p>
              <p className="text-[10px] text-slate-600 leading-tight">
                Emergency OPD Available 24x7
              </p>
            </div>
          </div>

          {/* ========================================================= */}
          {/* 3. PATIENT DEMOGRAPHICS & VISIT METADATA TABLE */}
          {/* ========================================================= */}
          <div className="border border-slate-900 text-[10px] my-2 print:my-1.5">
            <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-900 border-b border-slate-900">
              <div className="p-1 px-2">
                <span className="font-bold text-slate-600">Patient Name: </span>
                <span className="font-black text-slate-900 uppercase">
                  {patient?.firstName} {patient?.lastName}
                </span>
              </div>
              <div className="p-1 px-2">
                <span className="font-bold text-slate-600">Patient ID (UHID): </span>
                <span className="font-mono font-bold text-slate-900">
                  {patient?.id ? patient.id.slice(-10).toUpperCase() : "—"}
                </span>
              </div>
              <div className="p-1 px-2">
                <span className="font-bold text-slate-600">Regn. Date: </span>
                <span className="font-bold text-slate-900">{formattedRxDate}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-900 border-b border-slate-900">
              <div className="p-1 px-2">
                <span className="font-bold text-slate-600">Address: </span>
                <span className="font-medium text-slate-900 truncate block">
                  {patient?.address || "—"}
                </span>
              </div>
              <div className="p-1 px-2">
                <span className="font-bold text-slate-600">Age / Sex: </span>
                <span className="font-bold text-slate-900">
                  {patientAge ? `${patientAge} Yrs` : "—"} / {patient?.gender || "—"}
                </span>
              </div>
              <div className="p-1 px-2">
                <span className="font-bold text-slate-600">OPD Category: </span>
                <span className="font-bold text-slate-900">General OPD</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-900 border-b border-slate-900">
              <div className="p-1 px-2">
                <span className="font-bold text-slate-600">Contact No: </span>
                <span className="font-bold text-slate-900">{patient?.phone || "—"}</span>
              </div>
              <div className="p-1 px-2">
                <span className="font-bold text-slate-600">Emergency Contact: </span>
                <span className="font-medium text-slate-900">{patient?.emergencyContact || "—"}</span>
              </div>
              <div className="p-1 px-2">
                <span className="font-bold text-slate-600">Visit Date/Time: </span>
                <span className="font-bold text-slate-900">
                  {appointment?.appointmentDate
                    ? `${format(new Date(appointment.appointmentDate), "dd/MM/yyyy")} (${appointment.appointmentTime || ""})`
                    : `${formattedRxDate} ${formattedRxTime}`}
                </span>
              </div>
            </div>

            {/* Vitals & Allergy Strip (Purely Real Database Fields) */}
            <div className="bg-slate-50 grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-900 text-[9.5px] p-0.5 px-2 font-medium">
              <div>
                <span className="font-bold text-slate-700">Blood Group:</span>{" "}
                <strong className="text-red-700">{patient?.bloodGroup || "Not Tested"}</strong>
              </div>
              <div className="pl-1.5">
                <span className="font-bold text-slate-700">Known Drug Allergies:</span>{" "}
                <span className="text-slate-900 font-bold">
                  {record?.allergies || "No Known Drug Allergies (NKDA)"}
                </span>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* 4. MAIN CLINICAL PRESCRIPTION BODY (2-COLUMN SPLIT) */}
          {/* ========================================================= */}
          <div className="grid grid-cols-1 md:grid-cols-12 border-t-2 border-b-2 border-slate-900 min-h-[360px] print:min-h-0">
            
            {/* ----------------------------------------------------- */}
            {/* LEFT COLUMN: Clinical Findings & Notes (5/12) */}
            {/* ----------------------------------------------------- */}
            <div className="md:col-span-5 p-2.5 space-y-2.5 text-[10.5px] border-b md:border-b-0 md:border-r-2 border-slate-900 bg-slate-50/40 print:p-2 print:space-y-2">
              
              {/* 1. Chief Complaints & Symptoms */}
              <div>
                <h3 className="font-bold text-slate-900 text-[10px] uppercase tracking-wide border-b border-slate-300 pb-0.5 mb-0.5">
                  1. Chief Complaints & Symptoms:
                </h3>
                <p className="text-slate-800 font-medium whitespace-pre-wrap pl-1 leading-snug">
                  {record?.symptoms || appointment?.reason || "Routine clinical evaluation and consultation."}
                </p>
              </div>

              {/* 2. Medical History & Allergies */}
              <div>
                <h3 className="font-bold text-slate-900 text-[10px] uppercase tracking-wide border-b border-slate-300 pb-0.5 mb-0.5">
                  2. Medical History & Known Sensitivities:
                </h3>
                <p className="text-slate-800 pl-1 text-[10px] leading-snug">
                  {record?.allergies
                    ? `Documented Allergies: ${record.allergies}`
                    : "No specific past medical allergies or chronic sensitivities reported."}
                </p>
              </div>

              {/* 3. Clinical Notes & Observations */}
              <div>
                <h3 className="font-bold text-slate-900 text-[10px] uppercase tracking-wide border-b border-slate-300 pb-0.5 mb-1">
                  3. Doctor's Clinical Notes:
                </h3>
                <p className="text-slate-800 pl-1 text-[10px] leading-snug whitespace-pre-wrap">
                  {record?.doctorNotes || "General physical examination and evaluation completed."}
                </p>
              </div>

              {/* 4. Provisional / Clinical Diagnosis */}
              <div className="bg-slate-100 border border-slate-300 p-1.5 rounded">
                <h3 className="font-black text-slate-900 text-[10px] uppercase tracking-wide mb-0.5">
                  4. Clinical Diagnosis:
                </h3>
                <p className="text-slate-950 font-bold text-[10.5px] pl-1 leading-snug">
                  {record?.diagnosis || "Clinical Diagnosis Pending Further Evaluation"}
                </p>
              </div>

              {/* 5. Treatment Plan */}
              <div>
                <h3 className="font-bold text-slate-900 text-[10px] uppercase tracking-wide border-b border-slate-300 pb-0.5 mb-0.5">
                  5. Clinical Plan / Treatment:
                </h3>
                <p className="text-slate-800 pl-1 text-[10px] leading-snug whitespace-pre-wrap">
                  {record?.treatment || "Administer pharmacological therapy as detailed in prescription plan."}
                </p>
              </div>

              {/* Appointment / Next Visit Stamp Box */}
              <div className="border-2 border-dashed border-slate-800 p-1.5 text-center bg-white">
                <p className="text-[9px] font-black uppercase tracking-wider text-slate-900 leading-tight">
                  NEXT FOLLOW-UP APPOINTMENT
                </p>
                <p className="text-[11px] font-black text-primary print:text-black my-0.5 leading-tight">
                  {record?.followUpDate
                    ? format(new Date(record.followUpDate), "dd MMMM yyyy")
                    : "SOS / As Advised by Physician"}
                </p>
                <p className="text-[8.5px] font-bold text-slate-600 leading-tight">
                  Hospital Helpdesk: (033) 7125 6666
                </p>
              </div>

            </div>

            {/* ----------------------------------------------------- */}
            {/* RIGHT COLUMN: Rx, Medications & General Advice (7/12) */}
            {/* ----------------------------------------------------- */}
            <div className="md:col-span-7 p-3 sm:p-4 flex flex-col justify-between space-y-4 print:p-2.5 print:space-y-2">
              
              <div className="space-y-3">
                {/* 6. Diet & General Advice */}
                <div className="border-b border-slate-200 pb-2">
                  <h3 className="font-black text-slate-900 text-[10.5px] uppercase tracking-wide mb-0.5">
                    6. Diet & General Advice:
                  </h3>
                  <p className="text-[10px] text-slate-800 font-medium pl-1 leading-snug">
                    {prescription.instructions || record?.doctorNotes || "Follow prescribed dosage and maintain proper hydration. Contact hospital if symptoms persist."}
                  </p>
                </div>

                {/* 7. Treatment Advice (Rx) */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-serif text-3xl font-black italic text-slate-900 leading-none">
                      ℞
                    </span>
                    <h3 className="font-black text-slate-900 text-xs uppercase tracking-wider">
                      7. Prescribed Medications:
                    </h3>
                  </div>

                  {/* Numbered Prescription Medicine Items (Real Doctor Prescribed Items) */}
                  <div className="space-y-2 pl-1.5">
                    {prescription.items && prescription.items.length > 0 ? (
                      prescription.items.map((item, idx) => (
                        <div
                          key={item.id}
                          className="border-b border-slate-200 pb-1.5 last:border-b-0 space-y-0.5 text-[10.5px]"
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="font-black text-xs text-slate-900">
                              {idx + 1}. {item.medicineName.toUpperCase()}
                            </span>
                            <span className="font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                              {item.dosage}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10.5px] font-semibold text-slate-800 pl-3">
                            <span>
                              <strong>Frequency:</strong> {item.frequency}
                            </span>
                            <span>
                              <strong>Duration:</strong>{" "}
                              <span className="text-primary print:text-black font-bold">{item.duration}</span>
                            </span>
                          </div>

                          {item.instructions && (
                            <p className="text-[10px] italic text-slate-600 pl-3">
                              <strong>Instructions:</strong> {item.instructions}
                            </p>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-[10px] text-slate-500 italic">No specific medications prescribed.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Doctor's Signature Block */}
              <div className="pt-4 print:pt-2 flex flex-col items-end text-right">
                <div className="text-center w-52 print:w-44">
                  {/* Signature line */}
                  <div className="h-10 print:h-8 flex items-center justify-center font-serif italic text-base text-slate-700 font-bold border-b border-slate-900 pb-0.5">
                    Dr. {doctor.user.firstName} {doctor.user.lastName}
                  </div>
                  <p className="text-[10.5px] font-black uppercase text-slate-900 mt-0.5 leading-tight">
                    SIGNATURE OF CONSULTANT
                  </p>
                  <p className="text-[9.5px] font-bold text-slate-600 leading-tight">
                    DR. {doctor.user.firstName.toUpperCase()} {doctor.user.lastName.toUpperCase()}
                  </p>
                  <p className="text-[8.5px] text-slate-500 font-medium leading-tight">
                    Reg. No: {doctor.id.slice(-6).toUpperCase()} | Date: {formattedRxDate}
                  </p>
                </div>
              </div>

            </div>

          </div>

          {/* ========================================================= */}
          {/* 5. PATIENT CONSENT & LEGAL DISCLAIMER FOOTER */}
          {/* ========================================================= */}
          <div className="pt-2 text-[9.5px] text-slate-700 space-y-1.5 print:pt-1.5">
            <p className="italic font-medium leading-tight">
              I have been explained in a language that I understand the entire contents of this prescription, diagnosis, and medical advice.
            </p>

            <div className="flex justify-between items-end pt-2 pb-1 text-[10.5px] border-b border-slate-300">
              <div>
                <p className="font-semibold text-slate-600">Patient / Attendant Signature: ______________________</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-slate-900">
                  DR. {doctor.user.firstName.toUpperCase()} {doctor.user.lastName.toUpperCase()}
                </p>
                <p className="text-[9.5px] text-slate-500 font-medium">
                  {doctor.qualification || "MBBS, MD"} | Dept. of {doctor.department?.name}
                </p>
              </div>
            </div>

            <p className="text-center text-[8.5px] font-bold text-slate-600 pt-0.5">
              For any medical emergency, please consult your nearest Hospital Emergency immediately or call SHDS 24x7 Emergency Helpline: (033) 7125 6666 / 1800 123 101 666
            </p>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}