"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { guardAction } from "@/lib/guards";

export async function getBedDashboardData() {
  try {
    await guardAction("beds", "read");

    const wards = await prisma.ward.findMany({
      include: {
        department: { select: { id: true, name: true } },
        beds: {
          include: {
            patient: { select: { id: true, firstName: true, lastName: true } },
            department: { select: { id: true, name: true } },
            doctor: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
            admissions: { where: { status: "ADMITTED" }, select: { id: true, admissionNumber: true, admittedAt: true }, take: 1 },
            updatedBy: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { bedNumber: "asc" },
        },
      },
      orderBy: [{ floor: "asc" }, { name: "asc" }],
    });

    // Expose the bed's current admission (if any) as `admission`
    for (const ward of wards) {
      ward.beds = ward.beds.map(({ admissions, ...bed }) => ({ ...bed, admission: admissions[0] ?? null }));
    }

    // Compute summary stats
    const allBeds = wards.flatMap((w) => w.beds);
    const stats = {
      total: allBeds.length,
      vacant: allBeds.filter((b) => b.status === "VACANT").length,
      occupied: allBeds.filter((b) => b.status === "OCCUPIED").length,
      reserved: allBeds.filter((b) => b.status === "RESERVED").length,
      needsCleaning: allBeds.filter((b) => b.status === "NEEDS_CLEANING").length,
    };

    // Group by floor
    const floors = {};
    for (const ward of wards) {
      if (!floors[ward.floor]) {
        floors[ward.floor] = [];
      }
      floors[ward.floor].push(ward);
    }

    return {
      success: true,
      data: { floors, stats, wards },
    };
  } catch (error) {
    if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
    if (error.message === "Forbidden") return { success: false, message: "Access denied" };
    if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
    console.error("Get bed dashboard error:", error);
    return { success: false, message: "Failed to fetch bed data" };
  }
}

export async function getDepartmentsForWard() {
  try {
    await guardAction("beds", "read");
    const departments = await prisma.department.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    return { success: true, data: departments };
  } catch {
    return { success: false, data: [] };
  }
}

export async function updateBedStatus(bedId, data) {
  try {
    const { user } = await guardAction("beds", "update");

    const bed = await prisma.bed.findUnique({ where: { id: bedId } });
    if (!bed) {
      return { success: false, message: "Bed not found" };
    }

    const previousStatus = bed.status;
    const newStatus = data.status || bed.status;
    const newBedNumber = data.bedNumber ? data.bedNumber.trim() : bed.bedNumber;
    const newBedType = data.bedType || bed.bedType;

    if (newBedNumber !== bed.bedNumber) {
      const duplicate = await prisma.bed.findFirst({
        where: {
          wardId: bed.wardId,
          bedNumber: newBedNumber,
          id: { not: bedId },
        },
      });
      if (duplicate) {
        return { success: false, message: `Bed number '${newBedNumber}' already exists in this ward` };
      }
    }

    // Occupancy is owned by admissions: a bed is filled by admitting a patient and freed by discharging them.
    if (newStatus === "OCCUPIED" && previousStatus !== "OCCUPIED") {
      return { success: false, message: "Use Admit Patient to occupy a bed" };
    }
    if (previousStatus === "OCCUPIED" && newStatus !== "OCCUPIED") {
      const admitted = await prisma.admission.count({ where: { bedId, status: "ADMITTED" } });
      if (admitted) return { success: false, message: "Discharge the patient before releasing this bed" };
    }
    const stillOccupied = newStatus === "OCCUPIED";
    const patientId = stillOccupied ? bed.patientId : null;
    const departmentId = stillOccupied ? bed.departmentId : null;
    const doctorId = stillOccupied ? bed.doctorId : null;

    // Update the bed
    const updatedBed = await prisma.bed.update({
      where: { id: bedId },
      data: {
        bedNumber: newBedNumber,
        bedType: newBedType,
        status: newStatus,
        patientId,
        departmentId,
        doctorId,
        notes: data.notes || null,
        statusUpdatedAt: new Date(),
        updatedById: user.id,
      },
    });

    // Create audit log if status changed
    if (previousStatus !== newStatus) {
      await prisma.bedStatusLog.create({
        data: {
          bedId,
          previousStatus,
          newStatus,
          changedById: user.id,
          notes: data.notes || null,
        },
      });
    }

    revalidatePath("/beds");
    revalidatePath("/dashboard");

    const needsCleaningAlert = newStatus === "NEEDS_CLEANING";

    return {
      success: true,
      message: `Bed ${newBedNumber} updated successfully`,
      data: { id: updatedBed.id, bedNumber: updatedBed.bedNumber, status: updatedBed.status },
      needsCleaningAlert,
    };
  } catch (error) {
    if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
    if (error.message === "Forbidden") return { success: false, message: "You do not have permission to update bed status" };
    if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
    console.error("Update bed status error:", error);
    return { success: false, message: "Failed to update bed status" };
  }
}

export async function deleteSingleBed(bedId) {
  try {
    await guardAction("beds", "delete");

    const bed = await prisma.bed.findUnique({ where: { id: bedId } });
    if (!bed) {
      return { success: false, message: "Bed not found" };
    }

    await prisma.bedStatusLog.deleteMany({ where: { bedId } });
    await prisma.bed.delete({ where: { id: bedId } });

    revalidatePath("/beds");
    revalidatePath("/dashboard");

    return { success: true, message: `Bed ${bed.bedNumber} deleted successfully` };
  } catch (error) {
    if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
    if (error.message === "Forbidden") return { success: false, message: "Only admins can delete beds" };
    if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
    console.error("Delete single bed error:", error);
    return { success: false, message: "Failed to delete bed" };
  }
}

export async function createWard(data) {
  try {
    await guardAction("beds", "create");

    const existing = await prisma.ward.findUnique({
      where: { name: data.name },
    });

    if (existing) {
      return { success: false, message: "Ward with this name already exists" };
    }

    const ward = await prisma.ward.create({
      data: {
        name: data.name,
        floor: data.floor,
        departmentId: data.departmentId,
        genderWard: data.genderWard || "MIXED",
      },
    });

    revalidatePath("/beds");
    return { success: true, message: "Ward created successfully", data: { id: ward.id, name: ward.name } };
  } catch (error) {
    if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
    if (error.message === "Forbidden") return { success: false, message: "You do not have permission to create wards" };
    if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
    console.error("Create ward error:", error);
    return { success: false, message: "Failed to create ward" };
  }
}

export async function createBed(data) {
  try {
    await guardAction("beds", "create");

    const existing = await prisma.bed.findFirst({
      where: {
        wardId: data.wardId,
        bedNumber: data.bedNumber.trim(),
      },
    });

    if (existing) {
      return { success: false, message: "A bed with this number already exists in this ward" };
    }

    const bed = await prisma.bed.create({
      data: {
        bedNumber: data.bedNumber.trim(),
        wardId: data.wardId,
        bedType: data.bedType || "GENERAL",
        status: data.status || "VACANT",
        notes: data.notes || null,
      },
    });

    revalidatePath("/beds");
    revalidatePath("/dashboard");

    return { success: true, message: "Bed created successfully", data: { id: bed.id, bedNumber: bed.bedNumber } };
  } catch (error) {
    if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
    if (error.message === "Forbidden") return { success: false, message: "You do not have permission to create beds" };
    if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
    console.error("Create bed error:", error);
    return { success: false, message: "Failed to create bed" };
  }
}

export async function deleteAllBedData() {
  try {
    await guardAction("beds", "delete");

    await prisma.bedStatusLog.deleteMany({});
    await prisma.bed.deleteMany({});
    await prisma.ward.deleteMany({});

    revalidatePath("/beds");
    revalidatePath("/dashboard");

    return { success: true, message: "All bed data deleted successfully" };
  } catch (error) {
    if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
    if (error.message === "Forbidden") return { success: false, message: "Only admins can delete bed data" };
    if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
    console.error("Delete all bed data error:", error);
    return { success: false, message: "Failed to delete bed data" };
  }
}
