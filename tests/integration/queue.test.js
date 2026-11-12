import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { checkInAppointment, callNextPatient, getQueue, getQueueDisplay } from "@/actions/queue";
import { completeAppointment } from "@/actions/appointments";
import { createUser, createDoctor, createPatient } from "../helpers/db";
import { loginAs } from "../helpers/cookie-jar";
import { istDayRange, istDateString } from "@/lib/dates";

let receptionist, docA, docB, patients, today;
const book = (doctorId, patientId, time, date = today) =>
  prisma.appointment.create({ data: { doctorId, patientId, appointmentDate: date, appointmentTime: time } });

beforeEach(async () => {
  today = istDayRange().start;
  receptionist = await createUser({ role: "RECEPTIONIST" });
  docA = await createDoctor({ firstName: "Rahul", lastName: "Mehta" });
  docB = await createDoctor({ firstName: "Sneha", lastName: "Iyer" });
  patients = [];
  for (const name of ["Sanjay", "Meera", "Kavya"]) patients.push((await createPatient({ firstName: name, lastName: "Rao" })).patient);
  await loginAs(receptionist);
});

describe("OPD check-in and tokens", () => {
  it("gives arriving patients the next token for their doctor, starting at 1 each day per doctor", async () => {
    const a1 = await book(docA.doctor.id, patients[0].id, "10:00");
    const a2 = await book(docA.doctor.id, patients[1].id, "10:15");
    const b1 = await book(docB.doctor.id, patients[2].id, "10:00");
    expect((await checkInAppointment(a2.id)).data.tokenNumber).toBe(1);
    expect((await checkInAppointment(a1.id)).data.tokenNumber).toBe(2);
    expect((await checkInAppointment(b1.id)).data.tokenNumber).toBe(1);
  });

  it("only checks in today's scheduled appointments, once", async () => {
    const tomorrow = istDayRange(istDateString(new Date(Date.now() + 86400000))).start;
    const later = await book(docA.doctor.id, patients[0].id, "10:00", tomorrow);
    expect(await checkInAppointment(later.id)).toMatchObject({ success: false, message: "Only today's appointments can be checked in" });

    const cancelled = await prisma.appointment.create({ data: { doctorId: docA.doctor.id, patientId: patients[1].id, appointmentDate: today, appointmentTime: "11:00", status: "CANCELLED" } });
    expect(await checkInAppointment(cancelled.id)).toMatchObject({ success: false, message: "This appointment is cancelled" });

    const ok = await book(docA.doctor.id, patients[2].id, "11:30");
    await checkInAppointment(ok.id);
    expect(await checkInAppointment(ok.id)).toMatchObject({ success: false, message: "Already checked in with token 1" });
  });
});

describe("doctor's queue", () => {
  it("shows who is waiting in token order and who has not arrived", async () => {
    const a1 = await book(docA.doctor.id, patients[0].id, "10:00");
    const a2 = await book(docA.doctor.id, patients[1].id, "10:15");
    await book(docA.doctor.id, patients[2].id, "10:30");
    await checkInAppointment(a2.id);
    await checkInAppointment(a1.id);

    const { data } = await getQueue({ doctorId: docA.doctor.id });
    const q = data.doctors[0];
    expect(q.waiting.map((w) => [w.tokenNumber, w.patient.firstName])).toEqual([[1, "Meera"], [2, "Sanjay"]]);
    expect(q.notArrived.map((n) => n.patient.firstName)).toEqual(["Kavya"]);
    expect(q.nowServing).toBeNull();
  });

  it("lets the doctor call the next token, and completing frees them for the one after", async () => {
    const a1 = await book(docA.doctor.id, patients[0].id, "10:00");
    const a2 = await book(docA.doctor.id, patients[1].id, "10:15");
    await checkInAppointment(a1.id);
    await checkInAppointment(a2.id);

    await loginAs(docA.user);
    const first = await callNextPatient();
    expect(first.data).toMatchObject({ tokenNumber: 1, patientName: "Sanjay Rao" });
    expect(await callNextPatient()).toMatchObject({ success: false, message: "Finish token 1 before calling the next patient" });

    await completeAppointment(a1.id);
    expect((await callNextPatient()).data.tokenNumber).toBe(2);
    expect(await callNextPatient()).toMatchObject({ success: false, message: "Finish token 2 before calling the next patient" });
  });

  it("tells the doctor when nobody is waiting", async () => {
    await loginAs(docB.user);
    expect(await callNextPatient()).toMatchObject({ success: false, message: "No patients are waiting" });
  });
});

describe("waiting-room display", () => {
  it("shows tokens with masked names only", async () => {
    const a1 = await book(docA.doctor.id, patients[0].id, "10:00");
    const a2 = await book(docA.doctor.id, patients[1].id, "10:15");
    await checkInAppointment(a1.id);
    await checkInAppointment(a2.id);
    await loginAs(docA.user);
    await callNextPatient();

    await loginAs(receptionist);
    const { data } = await getQueueDisplay();
    const board = data.find((d) => d.doctor === "Dr. Rahul Mehta");
    expect(board).toMatchObject({ nowServing: { token: 1, name: "Sanjay R." }, next: [{ token: 2, name: "Meera R." }] });
    expect(JSON.stringify(data)).not.toMatch(/phone|uhid|98765/);
  });

  it("is available to front office, doctors and nurses but not patients or attendants", async () => {
    for (const role of ["PATIENT", "WARD_ATTENDANT"]) {
      await loginAs(await createUser({ role }));
      expect((await getQueue({})).success).toBe(false);
      expect((await checkInAppointment("x")).success).toBe(false);
    }
    await loginAs(await createUser({ role: "NURSE" }));
    expect((await getQueue({})).success).toBe(true);
  });
});
