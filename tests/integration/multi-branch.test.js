import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { createBranch } from "@/actions/branches";
import { createDepartment as createDepartmentAction, getDepartments } from "@/actions/departments";
import { createWard, createBed, getBedDashboardData } from "@/actions/beds";
import { generateRegistrationCode, getRegistrationCodes } from "@/actions/registration-codes";
import { admitPatient, getAdmissions, getAdmitFormOptions } from "@/actions/admissions";
import { createUser, createPatient } from "../helpers/db";
import { loginAs } from "../helpers/cookie-jar";

/** Admin + department + ward + bed, fully set up inside the given branch. */
async function setUpBranch(branchName) {
  const superAdmin = await createUser({ role: "SUPER_ADMIN" });
  await loginAs(superAdmin);
  const branch = (await createBranch({ name: branchName })).data;

  const admin = await createUser({ role: "ADMIN", branchId: branch.id });
  await loginAs(admin);
  const dept = (await createDepartmentAction({ name: "Cardiology" })).data; // same name, different branch
  const ward = (await createWard({ name: "ICU", floor: 1, departmentId: dept.id })).data;
  await createBed({ wardId: ward.id, bedNumber: "ICU-01" });
  const doctor = await prisma.doctor.create({
    data: { userId: (await createUser({ role: "DOCTOR", branchId: branch.id })).id, departmentId: dept.id, specialization: "Cardiology" },
  });

  return { branch, admin, dept, ward, doctor };
}

describe("multi-branch isolation, end to end", () => {
  it("lets two branches use the same department and ward names without clashing", async () => {
    const a = await setUpBranch("Branch A");
    const b = await setUpBranch("Branch B");
    expect(a.dept.name).toBe(b.dept.name);
    expect(a.dept.id).not.toBe(b.dept.id);
  });

  it("shows a branch admin only their own branch's departments, beds and admissions", async () => {
    const a = await setUpBranch("HSR Branch");
    const b = await setUpBranch("Koramangala Branch");
    const p = (await createPatient()).patient; // patients are chain-wide

    await loginAs(a.admin);
    const admitted = await admitPatient({
      patientId: p.id, bedId: (await getAdmitFormOptions()).data.beds[0].id,
      departmentId: a.dept.id, doctorId: a.doctor.id, reason: "Chest pain",
    });
    expect(admitted.success).toBe(true);
    expect((await prisma.admission.findUnique({ where: { id: admitted.data.id } })).branchId).toBe(a.branch.id);

    expect((await getDepartments()).data.map((d) => d.id)).toEqual([a.dept.id]);
    expect((await getBedDashboardData()).data.wards.map((w) => w.id)).toEqual([a.ward.id]);
    expect((await getAdmissions()).data.map((ad) => ad.id)).toEqual([admitted.data.id]);
    // Branch A's admit form never offers Branch B's beds or departments.
    expect((await getAdmitFormOptions()).data.beds.some((bed) => bed.ward.id === b.ward.id)).toBe(false);

    await loginAs(b.admin);
    expect((await getDepartments()).data.map((d) => d.id)).toEqual([b.dept.id]);
    expect((await getAdmissions()).data).toEqual([]);
  });

  it("gives the super admin every branch, and the patient's own admission regardless of branch", async () => {
    const a = await setUpBranch("Central Branch");
    const b = await setUpBranch("North Branch");
    const p = await createPatient();

    await loginAs(a.admin);
    const admitted = await admitPatient({
      patientId: p.patient.id, bedId: (await getAdmitFormOptions()).data.beds[0].id,
      departmentId: a.dept.id, doctorId: a.doctor.id, reason: "Fever",
    });

    const superAdmin = await createUser({ role: "SUPER_ADMIN" });
    await loginAs(superAdmin);
    const allDepts = (await getDepartments({ limit: 50 })).data.map((d) => d.id);
    expect(allDepts).toEqual(expect.arrayContaining([a.dept.id, b.dept.id]));
    expect((await getAdmissions()).data.map((ad) => ad.id)).toContain(admitted.data.id);

    await loginAs(p.user);
    expect((await getAdmissions()).data.map((ad) => ad.id)).toEqual([admitted.data.id]);
  });

  it("scopes registration codes to the issuing admin's branch, and a chain-wide code needs an explicit branch", async () => {
    const a = await setUpBranch("East Branch");
    const b = await setUpBranch("West Branch");

    await loginAs(a.admin);
    const code = (await generateRegistrationCode({ role: "RECEPTIONIST" })).data;
    expect(code.branchId).toBe(a.branch.id); // an admin can only issue for their own branch
    expect((await getRegistrationCodes()).data.map((c) => c.id)).toEqual([code.id]);

    await loginAs(b.admin);
    expect((await getRegistrationCodes()).data.map((c) => c.id)).toEqual([]);

    const superAdmin = await createUser({ role: "SUPER_ADMIN" });
    await loginAs(superAdmin);
    expect((await generateRegistrationCode({ role: "RECEPTIONIST" })).success).toBe(false);
    expect((await generateRegistrationCode({ role: "RECEPTIONIST", branchId: b.branch.id })).data.branchId).toBe(b.branch.id);
  });

  it("refuses to admit into a bed or department outside the admin's own branch", async () => {
    const a = await setUpBranch("South Branch");
    const b = await setUpBranch("West Zone Branch");
    const p = await createPatient();

    await loginAs(a.admin);
    const bedInB = (await prisma.bed.findFirst({ where: { ward: { branchId: b.branch.id } } }));
    const res = await admitPatient({ patientId: p.patient.id, bedId: bedInB.id, departmentId: b.dept.id, doctorId: b.doctor.id, reason: "x" });
    expect(res.success).toBe(false);
  });
});
