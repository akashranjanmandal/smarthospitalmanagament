import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { kioskSendOtp, kioskVerify, kioskRegister, kioskCheckIn, kioskWalkIn, kioskOptions } from "@/actions/kiosk";
import { getAuthPayload } from "@/lib/auth/jwt";
import { createUser, createDoctor, createPatient } from "../helpers/db";
import { loginAs } from "../helpers/cookie-jar";
import { istDayRange } from "@/lib/dates";

let kiosk, doc;
async function identify(phone) {
  const sent = await kioskSendOtp(phone);
  return kioskVerify(phone, sent.devCode);
}

beforeEach(async () => {
  kiosk = await createUser({ role: "KIOSK", firstName: "Lobby", lastName: "Kiosk 1" });
  doc = await createDoctor({ firstName: "Rahul", lastName: "Mehta" });
  await loginAs(kiosk);
});

describe("kiosk: returning patient", () => {
  it("identifies the patient by mobile OTP and checks in today's appointment with a token", async () => {
    const { patient } = await createPatient({ firstName: "Sanjay", lastName: "Verma" });
    const appt = await prisma.appointment.create({ data: { doctorId: doc.doctor.id, patientId: patient.id, appointmentDate: istDayRange().start, appointmentTime: "10:00" } });

    const who = await identify(patient.phone);
    expect(who).toMatchObject({ success: true, data: { patient: { firstName: "Sanjay", uhid: expect.stringMatching(/^SHDS-/) } } });
    expect(who.data.appointments.map((a) => a.id)).toEqual([appt.id]);
    expect(JSON.stringify(who)).not.toContain(patient.phone);

    const res = await kioskCheckIn(who.data.ticket, appt.id);
    expect(res).toMatchObject({ success: true, data: { tokenNumber: 1, doctor: "Dr. Rahul Mehta" } });
  });

  it("never signs the kiosk into the patient's account", async () => {
    const { patient } = await createPatient();
    await identify(patient.phone);
    expect((await getAuthPayload()).userId).toBe(kiosk.id);
  });
});

describe("kiosk: new patient", () => {
  it("registers a new patient (with UHID) and gives a walk-in token", async () => {
    const who = await identify("9123456780");
    expect(who.data.patient).toBeNull();

    const reg = await kioskRegister(who.data.ticket, { firstName: "Asha", lastName: "Sen", gender: "FEMALE", dateOfBirth: "1990-05-01" });
    expect(reg).toMatchObject({ success: true, data: { patient: { firstName: "Asha", uhid: expect.stringMatching(/^SHDS-/) } } });
    expect(await prisma.user.findFirst({ where: { phone: "9123456780" } })).toMatchObject({ role: "PATIENT" });

    const walk = await kioskWalkIn(reg.data.ticket, { doctorId: doc.doctor.id });
    expect(walk).toMatchObject({ success: true, data: { tokenNumber: 1 } });
    const appt = await prisma.appointment.findFirst({ where: { patientId: reg.data.patient.id } });
    expect(appt).toMatchObject({ status: "SCHEDULED", tokenNumber: 1, reason: "Walk-in (kiosk)" });
    expect(appt.checkedInAt).toBeInstanceOf(Date);
  });

  it("needs name, gender and date of birth to register", async () => {
    const who = await identify("9123456781");
    expect(await kioskRegister(who.data.ticket, { firstName: "", gender: "MALE", dateOfBirth: "1990-01-01" })).toMatchObject({ success: false, message: "Enter your first name" });
  });
});

describe("kiosk safety", () => {
  it("rejects a wrong code", async () => {
    await kioskSendOtp("9123456782");
    expect(await kioskVerify("9123456782", "000000")).toMatchObject({ success: false });
  });

  it("rejects forged tickets and other patients' appointments", async () => {
    const a = await createPatient();
    const b = await createPatient();
    const theirs = await prisma.appointment.create({ data: { doctorId: doc.doctor.id, patientId: b.patient.id, appointmentDate: istDayRange().start, appointmentTime: "11:00" } });
    const who = await identify(a.patient.phone);
    expect(await kioskCheckIn(who.data.ticket, theirs.id)).toMatchObject({ success: false, message: "Appointment not found" });
    expect(await kioskCheckIn("not-a-ticket", theirs.id)).toMatchObject({ success: false, message: "Your session has ended. Please start again." });
    expect(await kioskWalkIn(who.data.ticket, { doctorId: "missing" })).toMatchObject({ success: false, message: "Choose a doctor" });
  });

  it("only works on a kiosk account", async () => {
    await loginAs(await createUser({ role: "RECEPTIONIST" }));
    expect((await kioskSendOtp("9123456783")).success).toBe(false);
  });

  it("lists departments with available doctors", async () => {
    const { data } = await kioskOptions();
    expect(data.departments[0].doctors.map((d) => d.name)).toEqual(["Dr. Rahul Mehta"]);
  });
});
