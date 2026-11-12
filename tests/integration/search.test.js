import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { globalSearch } from "@/actions/search";
import { admitPatient } from "@/actions/admissions";
import { seedWard } from "../helpers/db";
import { loginAs } from "../helpers/cookie-jar";

let h, admission, sanjay;
const groups = (res) => Object.fromEntries(res.data.map((g) => [g.type, g.items]));

beforeEach(async () => {
  h = await seedWard();
  await loginAs(h.receptionist);
  admission = (await admitPatient({ patientId: h.p1.patient.id, bedId: h.beds[0].id, departmentId: h.dept.id, doctorId: h.doctor.id, reason: "Fever" })).data;
  sanjay = await prisma.patient.findUnique({ where: { id: h.p1.patient.id } });
});

describe("global search", () => {
  it("finds patients by name, UHID or phone and links to their record", async () => {
    for (const q of ["sanj", sanjay.uhid, sanjay.phone.slice(-6)]) {
      const { patients } = groups(await globalSearch(q));
      expect(patients[0]).toMatchObject({ title: "Sanjay Verma", href: `/patients/${sanjay.id}` });
      expect(patients[0].subtitle).toContain(sanjay.uhid);
    }
  });

  it("finds an admission by IP number or patient name and links to the chart", async () => {
    const { admissions } = groups(await globalSearch(admission.admissionNumber));
    expect(admissions[0]).toMatchObject({ title: expect.stringContaining("Sanjay Verma"), href: `/admissions/${admission.id}` });
    expect(admissions[0].subtitle).toContain("GW-01");
  });

  it("finds doctors by name", async () => {
    const { doctors } = groups(await globalSearch("iyer"));
    expect(doctors[0]).toMatchObject({ title: "Dr. Sneha Iyer", href: `/doctors/${h.doctor.id}` });
  });

  it("only searches what the role is allowed to see", async () => {
    await loginAs(h.attendant);
    expect(Object.keys(groups(await globalSearch("sanjay")))).toEqual(["admissions"]);
    await loginAs(h.p2.user);
    expect(groups(await globalSearch("sanjay")).patients).toBeUndefined();
    expect(groups(await globalSearch("sanjay")).admissions).toBeUndefined();
  });

  it("ignores queries shorter than two characters", async () => {
    expect(await globalSearch("s")).toEqual({ success: true, data: [] });
  });
});
