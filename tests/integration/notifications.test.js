import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { getUserNotifications, markNotificationsRead, markAllNotificationsRead } from "@/actions/notifications";
import { createPatient, createDoctor } from "../helpers/db";
import { loginAs } from "../helpers/cookie-jar";

describe("notification read state", () => {
  it("survives across devices instead of living in one browser's storage", async () => {
    const { doctor, user } = await createDoctor();
    await prisma.appointment.create({ data: { doctorId: doctor.id, patientId: (await createPatient()).patient.id, appointmentDate: new Date(), appointmentTime: "10:00" } });
    await loginAs(user);

    const before = await getUserNotifications();
    expect(before.data.length).toBeGreaterThan(0);
    const unreadBefore = before.data.filter((n) => n.unread).map((n) => n.id);
    expect(unreadBefore.length).toBeGreaterThan(0);

    expect((await markNotificationsRead([unreadBefore[0]])).success).toBe(true);
    const after = await getUserNotifications();
    expect(after.data.find((n) => n.id === unreadBefore[0]).unread).toBe(false);

    // A second "session" (e.g. another device) for the same signed-in user sees the same read state
    // immediately, because it was never stored in a browser at all.
    const again = await getUserNotifications();
    expect(again.data.find((n) => n.id === unreadBefore[0]).unread).toBe(false);
  });

  it("marks everything currently shown as read in one call", async () => {
    const { doctor, user } = await createDoctor();
    await prisma.appointment.create({ data: { doctorId: doctor.id, patientId: (await createPatient()).patient.id, appointmentDate: new Date(), appointmentTime: "10:00" } });
    await loginAs(user);

    expect((await getUserNotifications()).data.some((n) => n.unread)).toBe(true);
    expect((await markAllNotificationsRead()).success).toBe(true);
    expect((await getUserNotifications()).data.some((n) => n.unread)).toBe(false);
  });

  it("keeps each user's read state separate", async () => {
    const a = await createDoctor();
    const b = await createDoctor({ departmentId: a.doctor.departmentId });
    const p = (await createPatient()).patient.id;
    await prisma.appointment.create({ data: { doctorId: a.doctor.id, patientId: p, appointmentDate: new Date(), appointmentTime: "09:00" } });
    await prisma.appointment.create({ data: { doctorId: b.doctor.id, patientId: p, appointmentDate: new Date(), appointmentTime: "09:30" } });

    await loginAs(a.user);
    await markAllNotificationsRead();
    expect((await getUserNotifications()).data.some((n) => n.unread)).toBe(false);

    await loginAs(b.user);
    expect((await getUserNotifications()).data.some((n) => n.unread)).toBe(true);
  });
});
