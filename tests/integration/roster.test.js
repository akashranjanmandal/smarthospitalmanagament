import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { assignToWard, removeAssignment, getMyWardsToday, getWardRoster } from "@/actions/roster";
import { getBedDashboardData } from "@/actions/beds";
import { getAdmissions, admitPatient } from "@/actions/admissions";
import { createWard, createBed } from "@/actions/beds";
import { seedWard, createUser } from "../helpers/db";
import { loginAs } from "../helpers/cookie-jar";
import { istDateString } from "@/lib/dates";

const admitData = (h, bedId) => ({
  patientId: h.p1.patient.id, bedId, departmentId: h.dept.id, doctorId: h.doctor.id, reason: "Fever",
});

describe("duty roster", () => {
  it("lets an admin assign a nurse to a ward for a shift, and the nurse sees it as their own", async () => {
    const h = await seedWard();
    await loginAs(h.admin);
    const res = await assignToWard({ userId: h.nurse.id, wardId: h.ward.id, shift: "DAY" });
    expect(res.success).toBe(true);

    await loginAs(h.nurse);
    const mine = await getMyWardsToday();
    expect(mine.data.map((w) => w.id)).toEqual([h.ward.id]);
  });

  it("refuses a duplicate shift, a non-nursing role, or a ward outside the admin's branch", async () => {
    const h = await seedWard();
    await loginAs(h.admin);
    await assignToWard({ userId: h.nurse.id, wardId: h.ward.id, shift: "DAY" });
    expect(await assignToWard({ userId: h.nurse.id, wardId: h.ward.id, shift: "DAY" })).toMatchObject({ success: false });
    expect(await assignToWard({ userId: h.doctorUser.id, wardId: h.ward.id })).toMatchObject({ success: false });
  });

  it("only an admin can assign or remove a shift", async () => {
    const h = await seedWard();
    await loginAs(h.nurse);
    expect((await assignToWard({ userId: h.nurse.id, wardId: h.ward.id })).success).toBe(false);

    await loginAs(h.admin);
    const assigned = (await assignToWard({ userId: h.nurse.id, wardId: h.ward.id })).data;
    await loginAs(h.nurse);
    expect((await removeAssignment(assigned.id)).success).toBe(false);
    await loginAs(h.admin);
    expect((await removeAssignment(assigned.id)).success).toBe(true);
  });

  it("an unrostered nurse still sees the whole branch (nothing breaks for staff with no roster yet)", async () => {
    const h = await seedWard();
    await loginAs(h.nurse);
    const dash = await getBedDashboardData();
    expect(dash.data.wards.map((w) => w.id)).toContain(h.ward.id);
  });

  it("a rostered nurse sees only their assigned ward's beds and admissions, not the rest of the branch", async () => {
    const h = await seedWard();
    await loginAs(h.admin);
    const otherWard = (await createWard({ name: "ICU", floor: 2, departmentId: h.dept.id })).data;
    const otherBed = (await createBed({ wardId: otherWard.id, bedNumber: "ICU-01" })).data;
    const admittedElsewhere = await admitPatient({ patientId: h.p2.patient.id, bedId: otherBed.id, departmentId: h.dept.id, doctorId: h.doctor.id, reason: "Chest pain" });
    const admittedHere = await admitPatient(admitData(h, h.beds[0].id));
    await assignToWard({ userId: h.nurse.id, wardId: h.ward.id });

    await loginAs(h.nurse);
    const dash = await getBedDashboardData();
    expect(dash.data.wards.map((w) => w.id)).toEqual([h.ward.id]);

    const admissions = await getAdmissions();
    expect(admissions.data.map((a) => a.id)).toEqual([admittedHere.data.id]);
    expect(admissions.data.map((a) => a.id)).not.toContain(admittedElsewhere.data.id);

    // Cannot escape the roster scope by asking for the other ward explicitly either.
    const escape = await getAdmissions({ wardId: otherWard.id });
    expect(escape.data).toEqual([]);
  });

  it("lets an admin view a ward's roster for a date", async () => {
    const h = await seedWard();
    await loginAs(h.admin);
    await assignToWard({ userId: h.nurse.id, wardId: h.ward.id, shift: "DAY" });
    await assignToWard({ userId: h.attendant.id, wardId: h.ward.id, shift: "NIGHT" });
    const roster = await getWardRoster(h.ward.id, istDateString());
    expect(roster.data).toHaveLength(2);
    expect(roster.data.map((r) => r.staff.id)).toEqual(expect.arrayContaining([h.nurse.id, h.attendant.id]));
  });
});
