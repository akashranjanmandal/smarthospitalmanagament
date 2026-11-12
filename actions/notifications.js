"use server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";

function safeFormat(dateVal, formatStr) {
  try {
    if (!dateVal) return "";
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "";
    return format(d, formatStr);
  } catch {
    return "";
  }
}

export async function getUserNotifications() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, data: [] };
    }

    const notifications = [];

    if (user.role === "PATIENT") {
      const patient = user.patient || (await prisma.patient.findUnique({ where: { userId: user.id } }));
      if (patient) {
        // 1. Patient's Appointments
        const appointments = await prisma.appointment.findMany({
          where: { patientId: patient.id },
          include: { doctor: { include: { user: true, department: true } } },
          orderBy: { updatedAt: "desc" },
          take: 10,
        });

        for (const apt of appointments) {
          const dateStr = safeFormat(apt.appointmentDate, "MMM d");
          const timeStr = apt.appointmentTime ? ` at ${apt.appointmentTime}` : "";
          const statusTitle =
            apt.status === "CANCELLED"
              ? "Appointment Cancelled"
              : apt.status === "COMPLETED"
              ? "Appointment Completed"
              : "Appointment Scheduled";

          const eventDate = apt.updatedAt || apt.createdAt;

          notifications.push({
            id: `apt-${apt.id}-${apt.status}`,
            title: statusTitle,
            desc: `With Dr. ${apt.doctor?.user?.firstName || ""} ${apt.doctor?.user?.lastName || ""} (${apt.doctor?.department?.name || "General"}) on ${dateStr}${timeStr}`,
            time: safeFormat(eventDate, "MMM d, h:mm a"),
            rawDate: eventDate,
            unread: apt.status === "SCHEDULED",
            href: "/appointments",
            type: "appointment",
          });
        }

        // 2. Patient's Feedback / Grievance Tickets
        const complaints = await prisma.complaint.findMany({
          where: {
            OR: [
              { patientId: patient.id },
              ...(user.email ? [{ patientEmail: user.email }] : [])
            ]
          },
          orderBy: { updatedAt: "desc" },
          take: 5,
        });

        for (const c of complaints) {
          const eventDate = c.updatedAt || c.createdAt;
          notifications.push({
            id: `cmp-${c.id}-${c.status}`,
            title: c.type === "FEEDBACK" ? "Feedback Submitted" : "Grievance Ticket",
            desc: `Ticket #${c.ticketNumber} — Status: ${c.status}`,
            time: safeFormat(eventDate, "MMM d, h:mm a"),
            rawDate: eventDate,
            unread: c.status === "SUBMITTED" || c.status === "IN_REVIEW",
            href: "/feedback",
            type: "feedback",
          });
        }

        // 3. Patient's Prescriptions
        const prescriptions = await prisma.prescription.findMany({
          where: { medicalRecord: { patientId: patient.id } },
          include: { doctor: { include: { user: true } } },
          orderBy: { createdAt: "desc" },
          take: 5,
        });

        for (const rx of prescriptions) {
          notifications.push({
            id: `rx-${rx.id}`,
            title: "New Prescription Issued",
            desc: `Prescribed by Dr. ${rx.doctor?.user?.firstName || ""} ${rx.doctor?.user?.lastName || ""}`,
            time: safeFormat(rx.createdAt, "MMM d, h:mm a"),
            rawDate: rx.createdAt,
            unread: true,
            href: `/prescriptions/${rx.id}`,
            type: "prescription",
          });
        }

        // 4. Patient's Bills
        const bills = await prisma.bill.findMany({
          where: { patientId: patient.id },
          orderBy: { createdAt: "desc" },
          take: 5,
        });

        for (const b of bills) {
          notifications.push({
            id: `bill-${b.id}`,
            title: `Invoice ${b.paymentStatus === "PAID" ? "Paid" : "Issued"}`,
            desc: `Amount: ₹${b.totalAmount.toFixed(2)} — Status: ${b.paymentStatus}`,
            time: safeFormat(b.createdAt, "MMM d, h:mm a"),
            rawDate: b.createdAt,
            unread: b.paymentStatus === "PENDING",
            href: `/billing/${b.id}`,
            type: "billing",
          });
        }
      }
    } else if (user.role === "DOCTOR") {
      const doctor = user.doctor || (await prisma.doctor.findUnique({ where: { userId: user.id } }));
      if (doctor) {
        // 1. Doctor's Assigned Appointments
        const appointments = await prisma.appointment.findMany({
          where: { doctorId: doctor.id },
          include: { patient: true },
          orderBy: { updatedAt: "desc" },
          take: 10,
        });

        for (const apt of appointments) {
          const dateStr = safeFormat(apt.appointmentDate, "MMM d");
          const timeStr = apt.appointmentTime ? ` at ${apt.appointmentTime}` : "";
          const statusTitle =
            apt.status === "CANCELLED"
              ? "Appointment Cancelled"
              : apt.status === "COMPLETED"
              ? "Appointment Completed"
              : "New Appointment Booked";

          const eventDate = apt.updatedAt || apt.createdAt;

          notifications.push({
            id: `doc-apt-${apt.id}-${apt.status}`,
            title: statusTitle,
            desc: `Patient ${apt.patient?.firstName || ""} ${apt.patient?.lastName || ""} — ${dateStr}${timeStr}`,
            time: safeFormat(eventDate, "MMM d, h:mm a"),
            rawDate: eventDate,
            unread: apt.status === "SCHEDULED",
            href: "/appointments",
            type: "appointment",
          });
        }

        // 2. Doctor's Assigned Complaints
        const complaints = await prisma.complaint.findMany({
          where: { OR: [{ assignedToId: user.id }, { doctorId: doctor.id }] },
          orderBy: { createdAt: "desc" },
          take: 5,
        });

        for (const c of complaints) {
          notifications.push({
            id: `doc-cmp-${c.id}`,
            title: `Grievance Ticket ${c.ticketNumber}`,
            desc: `Title: ${c.title} (${c.status})`,
            time: safeFormat(c.createdAt, "MMM d, h:mm a"),
            rawDate: c.createdAt,
            unread: c.status !== "RESOLVED",
            href: "/feedback/manage",
            type: "feedback",
          });
        }
      }
    } else {
      // ADMIN, SUPER_ADMIN, RECEPTIONIST
      const recentApts = await prisma.appointment.findMany({
        include: { patient: true, doctor: { include: { user: true } } },
        orderBy: { updatedAt: "desc" },
        take: 8,
      });

      for (const apt of recentApts) {
        const statusTitle =
          apt.status === "CANCELLED"
            ? "Appointment Cancelled"
            : apt.status === "COMPLETED"
            ? "Appointment Completed"
            : "New Appointment Booked";

        const eventDate = apt.updatedAt || apt.createdAt;

        notifications.push({
          id: `adm-apt-${apt.id}-${apt.status}`,
          title: statusTitle,
          desc: `Patient ${apt.patient?.firstName || ""} ${apt.patient?.lastName || ""} with Dr. ${apt.doctor?.user?.firstName || ""} ${apt.doctor?.user?.lastName || ""}`,
          time: safeFormat(eventDate, "MMM d, h:mm a"),
          rawDate: eventDate,
          unread: true,
          href: "/appointments",
          type: "appointment",
        });
      }

      const recentComplaints = await prisma.complaint.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
      });

      for (const c of recentComplaints) {
        notifications.push({
          id: `adm-cmp-${c.id}`,
          title: c.type === "FEEDBACK" ? "New Feedback Received" : "New Grievance Submitted",
          desc: `Ticket #${c.ticketNumber} (${c.category}) — Status: ${c.status}`,
          time: safeFormat(c.createdAt, "MMM d, h:mm a"),
          rawDate: c.createdAt,
          unread: c.status === "SUBMITTED",
          href: "/feedback/manage",
          type: "feedback",
        });
      }

      const recentBills = await prisma.bill.findMany({
        include: {
          patient: true,
          appointment: { include: { doctor: { include: { department: true } } } }
        },
        orderBy: { updatedAt: "desc" },
        take: 8,
      });

      for (const b of recentBills) {
        const patientName = b.patient ? `${b.patient.firstName || ""} ${b.patient.lastName || ""}`.trim() : "Patient";
        const deptName = b.appointment?.doctor?.department?.name || "General";
        const isPaid = b.paymentStatus === "PAID";
        const eventDate = b.updatedAt || b.createdAt;

        notifications.push({
          id: `adm-bill-${b.id}-${b.paymentStatus}`,
          title: isPaid ? "Bill Payment Completed" : "New Invoice Created",
          desc: `${patientName} (${deptName}) — ₹${b.totalAmount.toFixed(2)}`,
          time: safeFormat(eventDate, "MMM d, h:mm a"),
          rawDate: eventDate,
          unread: true,
          href: `/billing/${b.id}`,
          type: "billing",
        });
      }
    }

    // Sort all combined notifications by date descending
    notifications.sort((a, b) => new Date(b.rawDate || 0) - new Date(a.rawDate || 0));

    const top = notifications.slice(0, 10);
    // Read state is kept on the server (NotificationRead), not in the browser, so it is the same
    // on every device the same account signs into.
    const read = new Set(
      (await prisma.notificationRead.findMany({
        where: { userId: user.id, notificationId: { in: top.map((n) => n.id) } },
        select: { notificationId: true },
      })).map((r) => r.notificationId)
    );
    return { success: true, data: top.map((n) => (read.has(n.id) ? { ...n, unread: false } : n)) };
  } catch (error) {
    console.error("getUserNotifications error:", error);
    return { success: false, data: [] };
  }
}

/** Mark specific notifications read for the signed-in user; same ids stay read on any device. */
export async function markNotificationsRead(ids) {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, message: "Unauthorized" };
    const list = Array.isArray(ids) ? ids.filter(Boolean) : [];
    if (list.length === 0) return { success: true };

    await prisma.notificationRead.createMany({
      data: list.map((notificationId) => ({ userId: user.id, notificationId })),
      skipDuplicates: true,
    });
    return { success: true };
  } catch (error) {
    console.error("markNotificationsRead error:", error);
    return { success: false, message: "Failed to update notifications" };
  }
}

/** Mark every notification currently shown to the signed-in user as read. */
export async function markAllNotificationsRead() {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, message: "Unauthorized" };
    const current = await getUserNotifications();
    return markNotificationsRead(current.data.map((n) => n.id));
  } catch (error) {
    console.error("markAllNotificationsRead error:", error);
    return { success: false, message: "Failed to update notifications" };
  }
}
