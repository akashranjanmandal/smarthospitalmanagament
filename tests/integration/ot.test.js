import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { scheduleOT, getOTSchedule, getOTBooking, recordSignIn, recordTimeOut, recordSignOut, cancelOT } from "@/actions/ot";
import { admitPatient } from "@/actions/admissions";
import { createBranch } from "@/actions/branches";
import { createDepartment as createDepartmentAction } from "@/actions/departments";
import { seedWard, createUser, createDoctor } from "../helpers/db";
import { loginAs } from "../helpers/cookie-jar";

let h, admission;
const tomorrow = new Date(Date.now() + 86400000);

beforeEach(async () => {
  h = await seedWard();
  await loginAs(h.receptionist);
  admission = (await admitPatient({ patientId: h.p1.patient.id, bedId: h.beds[0].id, departmentId: h.dept.id, doctorId: h.doctor.id, reason: "Appendicitis" })).data;
});

describe("booking an operation", () => {
  it("lets a doctor schedule a procedure for an admitted patient", async () => {
    await loginAs(h.doctorUser);
    const res = await scheduleOT({ admissionId: admission.id, procedureName: "Appendectomy", surgeonId: h.doctor.id, theatre: "OT-1", scheduledAt: tomorrow });
    expect(res.success).toBe(true);
    expect(res.data).toMatchObject({ procedureName: "Appendectomy", theatre: "OT-1", status: "SCHEDULED" });
  });

  it("refuses a surgeon from another branch", async () => {
    const superAdmin = await createUser({ role: "SUPER_ADMIN" });
    await loginAs(superAdmin);
    const otherBranch = (await createBranch({ name: "Other City Branch" })).data;
    const otherAdmin = await createUser({ role: "ADMIN", branchId: otherBranch.id });
    await loginAs(otherAdmin);
    const otherDept = (await createDepartmentAction({ name: "Surgery" })).data;
    const otherDoctor = await createDoctor({ departmentId: otherDept.id, branchId: otherBranch.id });

    await loginAs(h.doctorUser);
    expect(await scheduleOT({ admissionId: admission.id, procedureName: "X", surgeonId: otherDoctor.doctor.id, theatre: "OT-1", scheduledAt: tomorrow }))
      .toMatchObject({ success: false });
  });

  it("refuses a patient who is not currently admitted", async () => {
    await loginAs(h.doctorUser);
    await prisma.admission.update({ where: { id: admission.id }, data: { status: "DISCHARGED" } });
    expect(await scheduleOT({ admissionId: admission.id, procedureName: "X", surgeonId: h.doctor.id, theatre: "OT-1", scheduledAt: tomorrow }))
      .toMatchObject({ success: false });
  });

  it("refuses receptionists and ward attendants, but allows admins", async () => {
    for (const who of [h.receptionist, h.attendant]) {
      await loginAs(who);
      expect((await scheduleOT({ admissionId: admission.id, procedureName: "X", surgeonId: h.doctor.id, theatre: "OT-1", scheduledAt: tomorrow })).success).toBe(false);
    }
    await loginAs(h.admin);
    expect((await scheduleOT({ admissionId: admission.id, procedureName: "X", surgeonId: h.doctor.id, theatre: "OT-1", scheduledAt: tomorrow })).success).toBe(true);
  });
});

describe("the WHO surgical safety checklist", () => {
  let booking;

  beforeEach(async () => {
    await loginAs(h.doctorUser);
    booking = (await scheduleOT({ admissionId: admission.id, procedureName: "Appendectomy", surgeonId: h.doctor.id, theatre: "OT-1", scheduledAt: tomorrow })).data;
  });

  it("walks through sign-in, time-out and sign-out in order, each stamped with who and when", async () => {
    await loginAs(h.nurse);
    const signIn = await recordSignIn(booking.id);
    expect(signIn.success).toBe(true);

    let b = (await getOTBooking(booking.id)).data;
    expect(b.signInAt).toBeTruthy();
    expect(b.signInById).toBe(h.nurse.id);
    expect(b.status).toBe("IN_PROGRESS");

    expect(await recordTimeOut(booking.id)).toMatchObject({ success: true });
    expect(await recordSignOut(booking.id)).toMatchObject({ success: true });

    b = (await getOTBooking(booking.id)).data;
    expect(b.status).toBe("COMPLETED");
    expect(b.timeOutAt).toBeTruthy();
    expect(b.signOutAt).toBeTruthy();
  });

  it("refuses to skip a phase out of order", async () => {
    await loginAs(h.nurse);
    expect(await recordTimeOut(booking.id)).toMatchObject({ success: false });
    expect(await recordSignOut(booking.id)).toMatchObject({ success: false });
    await recordSignIn(booking.id);
    expect(await recordSignOut(booking.id)).toMatchObject({ success: false });
  });

  it("lets a doctor or admin cancel a scheduled operation, but not a completed one", async () => {
    await loginAs(h.doctorUser);
    expect((await cancelOT(booking.id, "Patient spiked a fever")).success).toBe(true);
    expect((await getOTBooking(booking.id)).data.status).toBe("CANCELLED");

    const second = (await scheduleOT({ admissionId: admission.id, procedureName: "Appendectomy", surgeonId: h.doctor.id, theatre: "OT-1", scheduledAt: tomorrow })).data;
    await loginAs(h.nurse);
    await recordSignIn(second.id);
    await recordTimeOut(second.id);
    await recordSignOut(second.id);
    await loginAs(h.doctorUser);
    expect((await cancelOT(second.id, "too late")).success).toBe(false);
  });
});

describe("double-booking is refused", () => {
  const threeHoursLater = (d) => new Date(d.getTime() + 3 * 60 * 60 * 1000);

  it("refuses the same theatre within the buffer window, even for a different surgeon and patient", async () => {
    await loginAs(h.admin);
    const otherDoctor = await createDoctor({ departmentId: h.dept.id });
    const second = (await admitPatient({ patientId: h.p2.patient.id, bedId: h.beds[1].id, departmentId: h.dept.id, doctorId: h.doctor.id, reason: "Fracture" })).data;

    await loginAs(h.doctorUser);
    expect((await scheduleOT({ admissionId: admission.id, procedureName: "A", surgeonId: h.doctor.id, theatre: "OT-1", scheduledAt: tomorrow })).success).toBe(true);
    expect(await scheduleOT({ admissionId: second.id, procedureName: "B", surgeonId: otherDoctor.doctor.id, theatre: "OT-1", scheduledAt: tomorrow }))
      .toMatchObject({ success: false });
    // Comfortably outside the buffer, same theatre, is fine.
    expect((await scheduleOT({ admissionId: second.id, procedureName: "B", surgeonId: otherDoctor.doctor.id, theatre: "OT-1", scheduledAt: new Date(tomorrow.getTime() + 8 * 60 * 60 * 1000) })).success).toBe(true);
  });

  it("refuses the same surgeon within the buffer window, even in a different theatre", async () => {
    await loginAs(h.admin);
    const second = (await admitPatient({ patientId: h.p2.patient.id, bedId: h.beds[1].id, departmentId: h.dept.id, doctorId: h.doctor.id, reason: "Fracture" })).data;

    await loginAs(h.doctorUser);
    await scheduleOT({ admissionId: admission.id, procedureName: "A", surgeonId: h.doctor.id, theatre: "OT-1", scheduledAt: tomorrow });
    expect(await scheduleOT({ admissionId: second.id, procedureName: "B", surgeonId: h.doctor.id, theatre: "OT-2", scheduledAt: threeHoursLater(tomorrow) }))
      .toMatchObject({ success: false });
  });

  it("ignores cancelled bookings when checking for a conflict", async () => {
    await loginAs(h.doctorUser);
    const first = (await scheduleOT({ admissionId: admission.id, procedureName: "A", surgeonId: h.doctor.id, theatre: "OT-1", scheduledAt: tomorrow })).data;
    await cancelOT(first.id, "Patient unwell");
    expect((await scheduleOT({ admissionId: admission.id, procedureName: "B", surgeonId: h.doctor.id, theatre: "OT-1", scheduledAt: tomorrow })).success).toBe(true);
  });
});

describe("the OT schedule board", () => {
  it("lists bookings for the day, scoped to the signed-in staff's branch", async () => {
    await loginAs(h.doctorUser);
    await scheduleOT({ admissionId: admission.id, procedureName: "Appendectomy", surgeonId: h.doctor.id, theatre: "OT-1", scheduledAt: new Date() });

    await loginAs(h.admin);
    const list = await getOTSchedule();
    expect(list.data).toHaveLength(1);
    expect(list.data[0]).toMatchObject({ procedureName: "Appendectomy" });
  });
});
