import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { createDepartment, updateDepartment, deleteDepartment } from "@/actions/departments";
import { getAuditLogs } from "@/actions/audit";
import { authenticateUser } from "@/lib/auth";
import { createUser, PASSWORD } from "../helpers/db";
import { loginAs } from "../helpers/cookie-jar";

const logsFor = (entity) => prisma.auditLog.findMany({ where: { entity }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });

describe("audit trail", () => {
  it("records who created, changed and deleted a record, with before and after values", async () => {
    const admin = await createUser({ role: "ADMIN", firstName: "Asha" });
    await loginAs(admin);
    const { data: dept } = await createDepartment({ name: "Neurology" });
    await updateDepartment(dept.id, { name: "Neurology & Neurosurgery" });
    await deleteDepartment(dept.id);

    const logs = await logsFor("Department");
    expect(logs.map((l) => l.action)).toEqual(["CREATE", "UPDATE", "DELETE"]);
    for (const l of logs) expect(l).toMatchObject({ actorId: admin.id, actorRole: "ADMIN", entityId: dept.id });
    expect(logs[1].changes).toMatchObject({
      fields: ["name"],
      before: { name: "Neurology" },
      after: { name: "Neurology & Neurosurgery" },
    });
  });

  it("never writes password hashes into the log", async () => {
    const user = await createUser({ role: "RECEPTIONIST", email: "desk@test.local" });
    await prisma.user.update({ where: { id: user.id }, data: { password: "$2a$04$abcdefghijklmnopqrstuv" } });
    const logs = await prisma.auditLog.findMany({ where: { entity: "User", entityId: user.id } });
    expect(logs.map((l) => l.action)).toEqual(["CREATE", "UPDATE"]);
    expect(JSON.stringify(logs)).not.toMatch(/\$2[aby]\$/);
  });

  it("records sign-ins and failed sign-in attempts", async () => {
    const user = await createUser({ role: "NURSE", email: "nurse@test.local" });
    await authenticateUser("nurse@test.local", PASSWORD);
    await authenticateUser("nurse@test.local", "wrong-password");
    const logs = await prisma.auditLog.findMany({ where: { action: { in: ["LOGIN", "LOGIN_FAILED"] } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    expect(logs.map((l) => [l.action, l.entityId])).toEqual([["LOGIN", user.id], ["LOGIN_FAILED", user.id]]);
  });

  it("lets administrators browse and filter the log", async () => {
    const admin = await createUser({ role: "ADMIN", firstName: "Asha", lastName: "Rao" });
    await loginAs(admin);
    await createDepartment({ name: "ENT" });
    await createDepartment({ name: "Dermatology" });

    const all = await getAuditLogs({ entity: "Department" });
    expect(all.success).toBe(true);
    expect(all.data.total).toBe(2);
    expect(all.data.logs[0]).toMatchObject({ action: "CREATE", entity: "Department", actor: { firstName: "Asha", lastName: "Rao" }, summary: "Created department" });

    expect((await getAuditLogs({ action: "DELETE" })).data.total).toBe(0);
    expect((await getAuditLogs({ actorId: admin.id, entity: "Department" })).data.total).toBe(2);
  });

  it("is closed to everyone except administrators", async () => {
    for (const role of ["RECEPTIONIST", "DOCTOR", "NURSE", "WARD_ATTENDANT", "PATIENT"]) {
      await loginAs(await createUser({ role }));
      expect((await getAuditLogs({})).success).toBe(false);
    }
  });
});
