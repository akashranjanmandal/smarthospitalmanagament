import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { createBranch, updateBranch, getBranches } from "@/actions/branches";
import { createUser } from "../helpers/db";
import { loginAs } from "../helpers/cookie-jar";

describe("branches (chain management)", () => {
  it("lets a super admin create a branch with a generated code", async () => {
    await loginAs(await createUser({ role: "SUPER_ADMIN" }));
    const res = await createBranch({ name: "Koramangala", city: "Bengaluru" });
    expect(res.success).toBe(true);
    expect(res.data).toMatchObject({ name: "Koramangala", city: "Bengaluru", status: "ACTIVE" });
    expect(res.data.code).toBeTruthy();
  });

  it("refuses two branches with the same name", async () => {
    await loginAs(await createUser({ role: "SUPER_ADMIN" }));
    await createBranch({ name: "Whitefield" });
    expect((await createBranch({ name: "Whitefield" })).success).toBe(false);
  });

  it("refuses everyone except the super admin", async () => {
    for (const role of ["ADMIN", "RECEPTIONIST", "DOCTOR"]) {
      await loginAs(await createUser({ role }));
      expect((await createBranch({ name: `Branch ${role}` })).success).toBe(false);
    }
  });

  it("lets the super admin rename or deactivate a branch", async () => {
    await loginAs(await createUser({ role: "SUPER_ADMIN" }));
    const b = (await createBranch({ name: "HSR Layout" })).data;
    const renamed = await updateBranch(b.id, { name: "HSR Layout Branch", status: "INACTIVE" });
    expect(renamed.success).toBe(true);
    expect(renamed.data).toMatchObject({ name: "HSR Layout Branch", status: "INACTIVE" });
  });

  it("shows the super admin every branch, but a branch admin only their own", async () => {
    await loginAs(await createUser({ role: "SUPER_ADMIN" }));
    const a = (await createBranch({ name: "Branch A" })).data;
    await createBranch({ name: "Branch B" });

    const asSuper = await getBranches();
    expect(asSuper.data.map((b) => b.name)).toEqual(expect.arrayContaining(["Branch A", "Branch B"]));

    const admin = await createUser({ role: "ADMIN", branchId: a.id });
    await loginAs(admin);
    const asAdmin = await getBranches();
    expect(asAdmin.data.map((b) => b.id)).toEqual([a.id]);
  });
});
