import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { createPatient as createPatientAction, getPatients } from "@/actions/patients";
import { registerUser } from "@/lib/auth";
import { createUser, createPatient } from "../helpers/db";
import { loginAs } from "../helpers/cookie-jar";

describe("UHID (chain-wide patient ID)", () => {
  it("gives every patient a unique, sequential UHID however they register", async () => {
    const { patient: direct } = await createPatient();
    await loginAs(await createUser({ role: "RECEPTIONIST" }));
    const { data: walkIn } = await createPatientAction({ firstName: "Kavya", lastName: "Reddy", gender: "FEMALE", dateOfBirth: "1992-03-14", phone: "9876511111" });
    await registerUser({ email: "self@test.local", password: "Test@1234", firstName: "Self", lastName: "Signup", role: "PATIENT" });
    const selfSignup = await prisma.patient.findFirst({ where: { user: { email: "self@test.local" } } });

    const uhids = [direct.uhid ?? (await prisma.patient.findUnique({ where: { id: direct.id } })).uhid, walkIn.uhid, selfSignup?.uhid];
    expect(uhids).toEqual(["SHDS-00000001", "SHDS-00000002", "SHDS-00000003"]);
  });

  it("finds a patient by UHID from the patient list", async () => {
    await createPatient();
    const { patient } = await createPatient({ firstName: "Meera" });
    await loginAs(await createUser({ role: "RECEPTIONIST" }));
    const { uhid } = await prisma.patient.findUnique({ where: { id: patient.id } });
    const res = await getPatients({ search: uhid });
    expect(res.data.map((p) => p.firstName)).toEqual(["Meera"]);
  });
});
