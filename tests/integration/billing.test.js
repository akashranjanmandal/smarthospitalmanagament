import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { createBill, updateBill, markBillPaid, getBills } from "@/actions/billing";
import { createDoctor, createPatient, createAppointment, createUser } from "../helpers/db";
import { loginAs } from "../helpers/cookie-jar";

async function setup() {
  const { doctor, user: doctorUser } = await createDoctor();
  const { patient, user: patientUser } = await createPatient();
  const appointment = await createAppointment({ doctorId: doctor.id, patientId: patient.id });
  const receptionist = await createUser({ role: "RECEPTIONIST" });
  return { doctor, doctorUser, patient, patientUser, appointment, receptionist };
}

describe("billing", () => {
  it("creates a bill with the correct total", async () => {
    const s = await setup();
    await loginAs(s.receptionist);
    const r = await createBill({ appointmentId: s.appointment.id, patientId: s.patient.id, consultationFee: 800, additionalCharges: 1500, discount: 100 });
    expect(r.success).toBe(true);
    expect(r.data.totalAmount).toBe(2200);
  });

  it("rejects a discount bigger than the bill", async () => {
    const s = await setup();
    await loginAs(s.receptionist);
    const r = await createBill({ appointmentId: s.appointment.id, patientId: s.patient.id, consultationFee: 100, discount: 500 });
    expect(r.success).toBe(false);
    expect(await prisma.bill.count()).toBe(0);
  });

  it("rejects negative amounts", async () => {
    const s = await setup();
    await loginAs(s.receptionist);
    const r = await createBill({ appointmentId: s.appointment.id, patientId: s.patient.id, consultationFee: -50 });
    expect(r.success).toBe(false);
  });

  it("rejects an update that would make the total negative", async () => {
    const s = await setup();
    await loginAs(s.receptionist);
    const { data: bill } = await createBill({ appointmentId: s.appointment.id, patientId: s.patient.id, consultationFee: 500 });
    const r = await updateBill(bill.id, { consultationFee: 500, discount: 900, paymentStatus: "PENDING" });
    expect(r.success).toBe(false);
    expect((await prisma.bill.findUnique({ where: { id: bill.id } })).totalAmount).toBe(500);
  });

  it("allows only one bill per appointment", async () => {
    const s = await setup();
    await loginAs(s.receptionist);
    await createBill({ appointmentId: s.appointment.id, patientId: s.patient.id, consultationFee: 500 });
    expect((await createBill({ appointmentId: s.appointment.id, patientId: s.patient.id, consultationFee: 500 })).success).toBe(false);
  });

  it("marks a bill paid, and blocks doctors and patients from billing", async () => {
    const s = await setup();
    await loginAs(s.receptionist);
    const { data: bill } = await createBill({ appointmentId: s.appointment.id, patientId: s.patient.id, consultationFee: 500 });
    await loginAs(s.patientUser);
    expect((await markBillPaid(bill.id, "CASH")).success).toBe(false);
    await loginAs(s.doctorUser);
    expect((await createBill({ appointmentId: s.appointment.id, patientId: s.patient.id, consultationFee: 1 })).success).toBe(false);
    await loginAs(s.receptionist);
    const paid = await markBillPaid(bill.id, "UPI");
    expect(paid.success).toBe(true);
    expect((await prisma.bill.findUnique({ where: { id: bill.id } })).paymentStatus).toBe("PAID");
    await loginAs(s.patientUser);
    expect((await getBills({})).data).toHaveLength(1);
  });
});
