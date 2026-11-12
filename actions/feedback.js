"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { guardAction } from "@/lib/guards";
import { SLA_HOURS_BY_SEVERITY } from "@/lib/constants";

function generateTicketNumber() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `TKT-${code}`;
}

export async function submitPublicFeedback(data) {
  try {
    const severity = data.severity || "MEDIUM";
    const slaHours = SLA_HOURS_BY_SEVERITY[severity] || 48;
    const slaDeadline = new Date(Date.now() + slaHours * 60 * 60 * 1000);

    let ticketNumber = generateTicketNumber();
    let exists = await prisma.complaint.findUnique({ where: { ticketNumber } });
    while (exists) {
      ticketNumber = generateTicketNumber();
      exists = await prisma.complaint.findUnique({ where: { ticketNumber } });
    }

    // Auto-route: check if there is a doctor or head in this department to assign to
    let assignedUserId = null;
    if (data.departmentId) {
      const deptDoctor = await prisma.doctor.findFirst({
        where: { departmentId: data.departmentId, available: true },
        select: { userId: true },
      });
      if (deptDoctor) {
        assignedUserId = deptDoctor.userId;
      }
    }

    const complaint = await prisma.complaint.create({
      data: {
        ticketNumber,
        type: data.type || "COMPLAINT",
        category: data.category,
        severity,
        status: assignedUserId ? "ASSIGNED" : "SUBMITTED",
        escalationLevel: "LEVEL_1_DEPT_HEAD",
        title: data.title,
        description: data.description,
        location: data.location || null,
        isAnonymous: Boolean(data.isAnonymous),
        patientName: data.isAnonymous ? null : (data.patientName || null),
        patientPhone: data.isAnonymous ? null : (data.patientPhone || null),
        patientEmail: data.isAnonymous ? null : (data.patientEmail || null),
        departmentId: data.departmentId,
        doctorId: data.doctorId || null,
        assignedToId: assignedUserId,
        slaDeadline,
      },
      include: {
        department: { select: { id: true, name: true } },
      },
    });

    // Create initial tracking log
    await prisma.complaintEscalationLog.create({
      data: {
        complaintId: complaint.id,
        fromLevel: "LEVEL_1_DEPT_HEAD",
        toLevel: "LEVEL_1_DEPT_HEAD",
        triggerReason: "Ticket submitted via Kiosk/Portal and routed to Department Head",
        actionNote: assignedUserId
          ? "Automatically assigned to department duty officer."
          : "Pending assignment by department head.",
      },
    });

    revalidatePath("/feedback");
    revalidatePath("/feedback/manage");

    return {
      success: true,
      message: "Feedback submitted successfully",
      ticketNumber,
      data: {
        id: complaint.id,
        ticketNumber,
        departmentName: complaint.department.name,
        slaDeadline: complaint.slaDeadline,
      },
    };
  } catch (error) {
    console.error("Submit feedback error:", error);
    return { success: false, message: "Failed to submit feedback. Please try again." };
  }
}

export async function trackTicketPublic(ticketNumber) {
  try {
    if (!ticketNumber || typeof ticketNumber !== "string") {
      return { success: false, message: "Please provide a valid ticket reference number" };
    }

    const cleanCode = ticketNumber.trim().toUpperCase();

    const complaint = await prisma.complaint.findUnique({
      where: { ticketNumber: cleanCode },
      select: {
        ticketNumber: true,
        type: true,
        category: true,
        severity: true,
        status: true,
        escalationLevel: true,
        title: true,
        description: true,
        location: true,
        isAnonymous: true,
        patientName: true,
        createdAt: true,
        slaDeadline: true,
        resolvedAt: true,
        resolutionSummary: true,
        actionTaken: true,
        department: { select: { name: true } },
        escalationLogs: {
          select: {
            id: true,
            fromLevel: true,
            toLevel: true,
            triggerReason: true,
            createdAt: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!complaint) {
      return { success: false, message: `Ticket "${cleanCode}" not found. Please verify the code.` };
    }

    return { success: true, data: complaint };
  } catch (error) {
    console.error("Track ticket error:", error);
    return { success: false, message: "Error looking up ticket" };
  }
}

export async function getFeedbackDashboardData(filters = {}) {
  try {
    // Staff-only view of everyone's tickets; patients track their own by ticket number.
    const { user, role } = await guardAction("feedback", "update");

    const andConditions = [];

    if (filters.status && filters.status !== "all") {
      andConditions.push({ status: filters.status });
    }
    if (filters.severity && filters.severity !== "all") {
      andConditions.push({ severity: filters.severity });
    }
    if (filters.escalationLevel && filters.escalationLevel !== "all") {
      andConditions.push({ escalationLevel: filters.escalationLevel });
    }
    if (filters.departmentId && filters.departmentId !== "all") {
      andConditions.push({ departmentId: filters.departmentId });
    }
    if (filters.category && filters.category !== "all") {
      andConditions.push({ category: filters.category });
    }
    if (filters.search) {
      andConditions.push({
        OR: [
          { ticketNumber: { contains: filters.search, mode: "insensitive" } },
          { title: { contains: filters.search, mode: "insensitive" } },
          { description: { contains: filters.search, mode: "insensitive" } },
          { patientName: { contains: filters.search, mode: "insensitive" } },
        ],
      });
    }

    // Role-specific scoping if DOCTOR: view tickets in doctor's department or assigned
    if (role === "DOCTOR") {
      const doctor = await prisma.doctor.findUnique({ where: { userId: user.id } });
      if (doctor) {
        andConditions.push({
          OR: [
            { departmentId: doctor.departmentId },
            { doctorId: doctor.id },
            { assignedToId: user.id },
          ],
        });
      }
    }

    const where = andConditions.length > 0 ? { AND: andConditions } : {};

    const [complaints, allCount, activeCount, resolvedCount, allDepartments] = await Promise.all([
      prisma.complaint.findMany({
        where,
        include: {
          department: { select: { id: true, name: true } },
          doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
          assignedTo: { select: { id: true, firstName: true, lastName: true, role: true } },
          resolvedBy: { select: { id: true, firstName: true, lastName: true } },
          escalationLogs: { orderBy: { createdAt: "desc" } },
        },
        orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      }),
      prisma.complaint.count({}),
      prisma.complaint.count({
        where: { status: { in: ["SUBMITTED", "ASSIGNED", "UNDER_INVESTIGATION"] } },
      }),
      prisma.complaint.count({ where: { status: { in: ["RESOLVED", "CLOSED"] } } }),
      prisma.department.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const now = new Date();
    const overdueCount = complaints.filter(
      (c) => ["SUBMITTED", "ASSIGNED", "UNDER_INVESTIGATION"].includes(c.status) && new Date(c.slaDeadline) < now
    ).length;

    const escalatedLevel2 = complaints.filter((c) => c.escalationLevel === "LEVEL_2_ADMIN").length;
    const escalatedLevel3 = complaints.filter((c) => c.escalationLevel === "LEVEL_3_DIRECTOR").length;

    return {
      success: true,
      data: {
        complaints,
        departments: allDepartments,
        stats: {
          total: allCount,
          active: activeCount,
          resolved: resolvedCount,
          overdue: overdueCount,
          level2: escalatedLevel2,
          level3: escalatedLevel3,
        },
      },
    };
  } catch (error) {
    if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
    if (error.message === "Forbidden") return { success: false, message: "Access denied" };
    console.error("Get feedback dashboard error:", error);
    return { success: false, message: "Failed to fetch feedback dashboard" };
  }
}

export async function updateComplaintStatus(complaintId, data) {
  try {
    const { user } = await guardAction("feedback", "update");

    const complaint = await prisma.complaint.findUnique({ where: { id: complaintId } });
    if (!complaint) {
      return { success: false, message: "Complaint not found" };
    }

    const isResolved = data.status === "RESOLVED" || data.status === "CLOSED";

    const updated = await prisma.complaint.update({
      where: { id: complaintId },
      data: {
        status: data.status,
        resolutionSummary: data.resolutionSummary || complaint.resolutionSummary,
        actionTaken: data.actionTaken || complaint.actionTaken,
        resolvedAt: isResolved ? new Date() : null,
        resolvedById: isResolved ? user.id : complaint.resolvedById,
      },
    });

    await prisma.complaintEscalationLog.create({
      data: {
        complaintId,
        fromLevel: complaint.escalationLevel,
        toLevel: complaint.escalationLevel,
        triggerReason: `Status updated to ${data.status.replace("_", " ")}`,
        actionNote: data.resolutionSummary || data.actionTaken || "Status updated by authority",
        triggeredById: user.id,
      },
    });

    revalidatePath("/feedback");
    revalidatePath("/feedback/manage");

    return { success: true, message: `Ticket status updated to ${data.status}`, data: updated };
  } catch (error) {
    if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
    if (error.message === "Forbidden") return { success: false, message: "Permission denied" };
    console.error("Update complaint status error:", error);
    return { success: false, message: "Failed to update complaint status" };
  }
}

export async function escalateComplaint(complaintId, { targetLevel, reason }) {
  try {
    const { user } = await guardAction("feedback", "update");

    const complaint = await prisma.complaint.findUnique({ where: { id: complaintId } });
    if (!complaint) {
      return { success: false, message: "Complaint not found" };
    }

    const updated = await prisma.complaint.update({
      where: { id: complaintId },
      data: {
        escalationLevel: targetLevel,
        lastEscalatedAt: new Date(),
      },
    });

    await prisma.complaintEscalationLog.create({
      data: {
        complaintId,
        fromLevel: complaint.escalationLevel,
        toLevel: targetLevel,
        triggerReason: reason || "Manual escalation by staff",
        triggeredById: user.id,
      },
    });

    revalidatePath("/feedback");
    revalidatePath("/feedback/manage");

    return { success: true, message: `Ticket escalated to ${targetLevel.replace(/_/g, " ")}`, data: updated };
  } catch (error) {
    if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
    if (error.message === "Forbidden") return { success: false, message: "Permission denied" };
    console.error("Escalate complaint error:", error);
    return { success: false, message: "Failed to escalate complaint" };
  }
}

export async function runEscalationBatch() {
  try {
    const now = new Date();

    // Find all unresolved complaints
    const unresolvedComplaints = await prisma.complaint.findMany({
      where: {
        status: { in: ["SUBMITTED", "ASSIGNED", "UNDER_INVESTIGATION"] },
      },
    });

    let escalatedCount = 0;

    for (const c of unresolvedComplaints) {
      const isPastSLA = new Date(c.slaDeadline) < now;

      // Rule 1: Level 1 Dept Head past SLA deadline -> escalate to Level 2 Admin
      if (c.escalationLevel === "LEVEL_1_DEPT_HEAD" && isPastSLA) {
        await prisma.complaint.update({
          where: { id: c.id },
          data: {
            escalationLevel: "LEVEL_2_ADMIN",
            lastEscalatedAt: now,
          },
        });

        await prisma.complaintEscalationLog.create({
          data: {
            complaintId: c.id,
            fromLevel: "LEVEL_1_DEPT_HEAD",
            toLevel: "LEVEL_2_ADMIN",
            triggerReason: "Automated SLA Breach Timer: Department Head resolution window expired",
            actionNote: "Auto-escalated to Hospital Administrator for immediate intervention.",
          },
        });

        escalatedCount++;
      }
      // Rule 2: Level 2 Admin escalated > 24 hours ago and still unresolved -> escalate to Level 3 Director
      else if (c.escalationLevel === "LEVEL_2_ADMIN") {
        const lastEsc = c.lastEscalatedAt || c.slaDeadline;
        const hoursInLevel2 = (now.getTime() - new Date(lastEsc).getTime()) / (1000 * 60 * 60);

        if (hoursInLevel2 >= 24) {
          await prisma.complaint.update({
            where: { id: c.id },
            data: {
              escalationLevel: "LEVEL_3_DIRECTOR",
              lastEscalatedAt: now,
            },
          });

          await prisma.complaintEscalationLog.create({
            data: {
              complaintId: c.id,
              fromLevel: "LEVEL_2_ADMIN",
              toLevel: "LEVEL_3_DIRECTOR",
              triggerReason: "Automated SLA Breach Timer: Level 2 Admin resolution window expired (>24h)",
              actionNote: "Auto-escalated to Medical Director for executive review.",
            },
          });

          escalatedCount++;
        }
      }
    }

    revalidatePath("/feedback");
    revalidatePath("/feedback/manage");

    return {
      success: true,
      evaluatedCount: unresolvedComplaints.length,
      escalatedCount,
      message: `Escalation check complete. Evaluated ${unresolvedComplaints.length} tickets, escalated ${escalatedCount}.`,
    };
  } catch (error) {
    console.error("Run escalation batch error:", error);
    return { success: false, message: "Failed to run escalation batch" };
  }
}

export async function seedFeedbackDemoData() {
  try {
    await guardAction("feedback", "create");

    const departments = await prisma.department.findMany({
      where: { status: "ACTIVE" },
      take: 4,
    });

    if (departments.length === 0) {
      return { success: false, message: "Please create active departments first." };
    }

    const demoItems = [
      {
        type: "COMPLAINT",
        category: "WAIT_TIME",
        severity: "CRITICAL",
        title: "Over 4 hours wait in Emergency with severe chest pain",
        description: "Patient was asked to sit in the triage area without vital monitoring for nearly 4 hours on Saturday evening.",
        location: "Emergency Triage Room 2",
        isAnonymous: false,
        patientName: "Rahul Sharma",
        patientPhone: "+91 98765 43210",
        patientEmail: "rahul.s@example.com",
        departmentId: departments[0].id,
        // Overdue by 15 hours
        hoursAgo: 27,
      },
      {
        type: "COMPLAINT",
        category: "CLEANLINESS",
        severity: "HIGH",
        title: "Sanitation issue in 2nd Floor General Ward restroom",
        description: "Restroom water tap leaking and floor slippery for past 24 hours. Poses severe fall risk for elderly post-op patients.",
        location: "Floor 2 Ward B Restroom",
        isAnonymous: true,
        departmentId: departments[1 % departments.length].id,
        // Overdue by 2 hours
        hoursAgo: 26,
      },
      {
        type: "COMPLAINT",
        category: "BILLING_ISSUE",
        severity: "MEDIUM",
        title: "Discrepancy in pharmacy charges on discharge bill",
        description: "Charged twice for IV fluids and antibiotics that were never administered during the final day.",
        location: "Billing Desk 3",
        isAnonymous: false,
        patientName: "Sunita Verma",
        patientPhone: "+91 91234 56789",
        departmentId: departments[2 % departments.length].id,
        hoursAgo: 10,
      },
      {
        type: "COMPLIMENT",
        category: "STAFF_BEHAVIOR",
        severity: "LOW",
        title: "Exceptional nursing care by Staff Nurse Priya",
        description: "Compassionate, prompt and attentive care throughout my mother's post-surgery recovery. Truly grateful.",
        location: "ICU Bed 04",
        isAnonymous: false,
        patientName: "Ananya Deshmukh",
        patientEmail: "ananya.d@example.com",
        departmentId: departments[0].id,
        hoursAgo: 4,
      },
      {
        type: "SUGGESTION",
        category: "FACILITY_AMENITIES",
        severity: "LOW",
        title: "Wheelchair accessibility ramp at South Entrance",
        description: "The curb near the ambulance bay is slightly high making self-wheelchair entry difficult.",
        location: "South Entrance Gate B",
        isAnonymous: true,
        departmentId: departments[3 % departments.length || 0].id,
        hoursAgo: 2,
      },
    ];

    for (const item of demoItems) {
      const ticketNumber = generateTicketNumber();
      const slaHours = SLA_HOURS_BY_SEVERITY[item.severity];
      const createdDate = new Date(Date.now() - item.hoursAgo * 60 * 60 * 1000);
      const slaDeadline = new Date(createdDate.getTime() + slaHours * 60 * 60 * 1000);

      const complaint = await prisma.complaint.create({
        data: {
          ticketNumber,
          type: item.type,
          category: item.category,
          severity: item.severity,
          status: "UNDER_INVESTIGATION",
          escalationLevel: "LEVEL_1_DEPT_HEAD",
          title: item.title,
          description: item.description,
          location: item.location,
          isAnonymous: item.isAnonymous,
          patientName: item.patientName || null,
          patientPhone: item.patientPhone || null,
          patientEmail: item.patientEmail || null,
          departmentId: item.departmentId,
          slaDeadline,
          createdAt: createdDate,
          updatedAt: createdDate,
        },
      });

      await prisma.complaintEscalationLog.create({
        data: {
          complaintId: complaint.id,
          fromLevel: "LEVEL_1_DEPT_HEAD",
          toLevel: "LEVEL_1_DEPT_HEAD",
          triggerReason: "Ticket submitted via Kiosk and routed to Department Head",
          createdAt: createdDate,
        },
      });
    }

    revalidatePath("/feedback");
    revalidatePath("/feedback/manage");

    return {
      success: true,
      message: `Generated ${demoItems.length} demo complaints (including SLA-breached tickets).`,
    };
  } catch (error) {
    if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
    if (error.message === "Forbidden") return { success: false, message: "Only admins can seed demo data" };
    console.error("Seed feedback demo error:", error);
    return { success: false, message: "Failed to seed demo feedback data" };
  }
}
