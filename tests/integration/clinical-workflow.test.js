import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { createDepartment as createDepartmentAction, deleteDepartment } from "@/actions/departments";
import { createDoctor as createDoctorAction } from "@/actions/doctors";
import { createPatient as createPatientAction } from "@/actions/patients";
import { createAppointment, cancelAppointment, completeAppointment, getAppointments } from "@/actions/appointments";
import { createMedicalRecord } from "@/actions/medical-records";
import { createPrescription } from "@/actions/prescriptions";
import { createWard, createBed, updateBedStatus } from "@/actions/beds";
import { admitPatient, dischargePatient } from "@/actions/admissions";
import { submitPublicFeedback, updateComplaintStatus, escalateComplaint, trackTicketPublic, getFeedbackDashboardData } from "@/actions/feedback";
import { createUser, createPatient, createDoctor } from "../helpers/db";
import { loginAs } from "../helpers/cookie-jar";

const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

describe("a patient's visit from booking to prescription", () => {
  it("works end to end with each role doing its part", async () => {
    const admin = await createUser({ role: "ADMIN" });
    const receptionist = await createUser({ role: "RECEPTIONIST" });

    await loginAs(admin);
    const dept = await createDepartmentAction({ name: "Cardiology" });
    expect(dept.success).toBe(true);
    const doc = await createDoctorAction({ email: "rahul@test.local", firstName: "Rahul", lastName: "Mehta", departmentId: dept.data.id, specialization: "Cardiology" });
    expect(doc.success).toBe(true);
    const doctorUser = await prisma.user.findUnique({ where: { email: "rahul@test.local" } });

    await loginAs(receptionist);
    const patient = await createPatientAction({ firstName: "Kavya", lastName: "Reddy", gender: "FEMALE", dateOfBirth: "1992-03-14", phone: "9876500002", email: "kavya@test.local" });
    expect(patient.success).toBe(true);
    const apt = await createAppointment({ doctorId: doc.data.id, patientId: patient.data.id, appointmentDate: tomorrow, appointmentTime: "11:00", reason: "Palpitations" });
    expect(apt.success).toBe(true);

    await loginAs(doctorUser);
    expect((await getAppointments({})).data).toHaveLength(1);
    expect((await completeAppointment(apt.data.id)).success).toBe(true);
    const record = await createMedicalRecord({ appointmentId: apt.data.id, patientId: patient.data.id, doctorId: doc.data.id, diagnosis: "Sinus tachycardia" });
    expect(record.success).toBe(true);
    const rx = await createPrescription({ medicalRecordId: record.data.id, items: [{ medicineName: "Propranolol", dosage: "10 mg", frequency: "BD", duration: "14 days" }] });
    expect(rx.success).toBe(true);
    expect(rx.data.items).toHaveLength(1);
  });
});

describe("appointments", () => {
  it("rejects double-booking and past dates", async () => {
    const { doctor } = await createDoctor();
    const { user } = await createPatient();
    await loginAs(user);
    expect((await createAppointment({ doctorId: doctor.id, appointmentDate: tomorrow, appointmentTime: "10:00" })).success).toBe(true);
    expect((await createAppointment({ doctorId: doctor.id, appointmentDate: tomorrow, appointmentTime: "10:00" })).success).toBe(false);
    expect((await createAppointment({ doctorId: doctor.id, appointmentDate: "2024-01-01", appointmentTime: "10:00" })).success).toBe(false);
  });

  it("lets patients cancel only their own appointments and never complete them", async () => {
    const { doctor } = await createDoctor();
    const a = await createPatient();
    const b = await createPatient();
    await loginAs(a.user);
    const mine = await createAppointment({ doctorId: doctor.id, appointmentDate: tomorrow, appointmentTime: "09:00" });
    await loginAs(b.user);
    const theirs = await createAppointment({ doctorId: doctor.id, appointmentDate: tomorrow, appointmentTime: "09:30" });
    await loginAs(a.user);
    expect((await cancelAppointment(theirs.data.id)).success).toBe(false);
    expect((await completeAppointment(mine.data.id)).success).toBe(false);
    expect((await cancelAppointment(mine.data.id)).success).toBe(true);
  });
});

describe("role restrictions on writes", () => {
  it("blocks writes outside each role's job", async () => {
    const { doctor } = await createDoctor();
    const p = await createPatient();
    const receptionist = await createUser({ role: "RECEPTIONIST" });
    const apt = await prisma.appointment.create({ data: { doctorId: doctor.id, patientId: p.patient.id, appointmentDate: new Date(), appointmentTime: "10:00" } });

    await loginAs(p.user);
    expect((await createDepartmentAction({ name: "Hack" })).success).toBe(false);
    await loginAs(receptionist);
    expect((await createMedicalRecord({ appointmentId: apt.id, patientId: p.patient.id, doctorId: doctor.id })).success).toBe(false);
    const dept = await prisma.department.findFirst();
    expect((await deleteDepartment(dept.id)).success).toBe(false);
  });
});

describe("beds", () => {
  it("creates wards and beds, admits and discharges a patient and logs every status change", async () => {
    const admin = await createUser({ role: "ADMIN" });
    const receptionist = await createUser({ role: "RECEPTIONIST" });
    const { doctor, user: doctorUser } = await createDoctor();
    const p = await createPatient();
    await loginAs(admin);
    const ward = await createWard({ name: "CCU", floor: 2, departmentId: doctor.departmentId });
    const bed = await createBed({ wardId: ward.data.id, bedNumber: "CCU-01", bedType: "ICU" });
    expect(bed.success).toBe(true);
    expect((await createBed({ wardId: ward.data.id, bedNumber: "CCU-01" })).success).toBe(false);

    await loginAs(receptionist);
    const admission = await admitPatient({ bedId: bed.data.id, patientId: p.patient.id, departmentId: doctor.departmentId, doctorId: doctor.id, reason: "Chest pain" });
    expect(admission.success).toBe(true);
    await loginAs(doctorUser);
    expect((await dischargePatient(admission.data.id, { finalDiagnosis: "Angina", conditionAtDischarge: "IMPROVED" })).success).toBe(true);
    await loginAs(receptionist);
    const vacant = await updateBedStatus(bed.data.id, { status: "VACANT" });
    expect(vacant.success).toBe(true);
    const cleaning = await updateBedStatus(bed.data.id, { status: "NEEDS_CLEANING" });
    expect(cleaning.needsCleaningAlert).toBe(true);
    expect(await prisma.bedStatusLog.count({ where: { bedId: bed.data.id } })).toBe(4);

    await loginAs(doctorUser);
    expect((await updateBedStatus(bed.data.id, { status: "VACANT" })).success).toBe(false);
  });
});

describe("feedback and grievances", () => {
  it("counts closed tickets as resolved in the dashboard stats", async () => {
    const { doctor } = await createDoctor();
    const admin = await createUser({ role: "ADMIN" });
    await loginAs(admin);
    const a = await submitPublicFeedback({ category: "OTHER", title: "A", description: "a", departmentId: doctor.departmentId });
    const b = await submitPublicFeedback({ category: "OTHER", title: "B", description: "b", departmentId: doctor.departmentId });
    await submitPublicFeedback({ category: "OTHER", title: "C", description: "c", departmentId: doctor.departmentId });
    await updateComplaintStatus(a.data.id, { status: "RESOLVED" });
    await updateComplaintStatus(b.data.id, { status: "CLOSED" });
    const { data } = await getFeedbackDashboardData({});
    expect(data.stats.resolved).toBe(2);
    expect(data.stats.active).toBe(1);
  });

  it("files, tracks, updates and escalates a complaint", async () => {
    const { doctor, user: doctorUser } = await createDoctor();
    const admin = await createUser({ role: "ADMIN" });
    const p = await createPatient();
    await loginAs(p.user);
    const filed = await submitPublicFeedback({ category: "WAIT_TIME", severity: "HIGH", title: "Late", description: "Waited 2 hours", departmentId: doctor.departmentId });
    expect(filed.success).toBe(true);
    expect((await trackTicketPublic(filed.ticketNumber)).data.status).toBe("ASSIGNED");
    expect((await updateComplaintStatus(filed.data.id, { status: "RESOLVED" })).success).toBe(false);

    await loginAs(doctorUser);
    expect((await updateComplaintStatus(filed.data.id, { status: "UNDER_INVESTIGATION" })).success).toBe(true);
    await loginAs(admin);
    expect((await escalateComplaint(filed.data.id, { targetLevel: "LEVEL_2_ADMIN", reason: "Recurring" })).success).toBe(true);
    const tracked = await trackTicketPublic(filed.ticketNumber);
    expect(tracked.data.escalationLevel).toBe("LEVEL_2_ADMIN");
    expect(tracked.data.escalationLogs.length).toBe(3);
  });
});
