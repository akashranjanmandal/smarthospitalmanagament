"use server";

import { prisma } from "@/lib/prisma";
import { guardAction } from "@/lib/guards";
import { canRead, isOwnOnly } from "@/lib/permissions";
import { lengthOfStayDays } from "@/lib/identifiers";

const LIMIT = 5;
const contains = (q) => ({ contains: q, mode: "insensitive" });
// Roles that may only see their own records get no cross-patient results.
const canSearch = (module, role) => canRead(module, role) && !isOwnOnly(module, role);

/** Top-bar search across patients, in-patient stays and doctors, limited to what the role may see. */
export async function globalSearch(query) {
  try {
    // Every signed-in role can read admissions (patients their own), so this just requires a session.
    const { role } = await guardAction("admissions", "read");
    const q = String(query ?? "").trim();
    if (q.length < 2) return { success: true, data: [] };

    const searches = [];

    if (canSearch("patients", role)) {
      searches.push(
        prisma.patient
          .findMany({
            where: { OR: [{ firstName: contains(q) }, { lastName: contains(q) }, { uhid: contains(q) }, { phone: { contains: q } }] },
            select: { id: true, uhid: true, firstName: true, lastName: true, phone: true, gender: true },
            orderBy: { firstName: "asc" },
            take: LIMIT,
          })
          .then((rows) => ({
            type: "patients",
            label: "Patients",
            items: rows.map((p) => ({ id: p.id, title: `${p.firstName} ${p.lastName}`.trim(), subtitle: `${p.uhid} · ${p.phone}`, href: `/patients/${p.id}` })),
          }))
      );
    }

    if (canSearch("admissions", role)) {
      searches.push(
        prisma.admission
          .findMany({
            where: {
              OR: [
                { admissionNumber: contains(q) },
                { patient: { firstName: contains(q) } },
                { patient: { lastName: contains(q) } },
                { patient: { uhid: contains(q) } },
              ],
            },
            select: {
              id: true, admissionNumber: true, status: true, admittedAt: true,
              patient: { select: { firstName: true, lastName: true } },
              bed: { select: { bedNumber: true, ward: { select: { name: true } } } },
            },
            orderBy: [{ status: "asc" }, { admittedAt: "desc" }],
            take: LIMIT,
          })
          .then((rows) => ({
            type: "admissions",
            label: "In-patient stays",
            items: rows.map((a) => ({
              id: a.id,
              title: `${a.patient.firstName} ${a.patient.lastName}`.trim() + ` · ${a.admissionNumber}`,
              subtitle: a.status === "ADMITTED" ? `Bed ${a.bed.bedNumber}, ${a.bed.ward.name} · Day ${lengthOfStayDays(a.admittedAt)}` : `Discharged · was in ${a.bed.bedNumber}`,
              href: `/admissions/${a.id}`,
            })),
          }))
      );
    }

    if (canSearch("doctors", role)) {
      searches.push(
        prisma.doctor
          .findMany({
            where: { OR: [{ user: { firstName: contains(q) } }, { user: { lastName: contains(q) } }, { specialization: contains(q) }] },
            select: { id: true, specialization: true, user: { select: { firstName: true, lastName: true } }, department: { select: { name: true } } },
            take: LIMIT,
          })
          .then((rows) => ({
            type: "doctors",
            label: "Doctors",
            items: rows.map((d) => ({
              id: d.id,
              title: `Dr. ${d.user.firstName ?? ""} ${d.user.lastName ?? ""}`.trim(),
              subtitle: [d.department?.name, d.specialization].filter(Boolean).join(" · "),
              href: `/doctors/${d.id}`,
            })),
          }))
      );
    }

    const groups = await Promise.all(searches);
    return { success: true, data: groups.filter((g) => g.items.length) };
  } catch (error) {
    if (error.message === "Unauthorized") return { success: false, message: "Unauthorized", data: [] };
    if (error.message === "Forbidden") return { success: true, data: [] };
    console.error("Global search error:", error);
    return { success: false, message: "Search failed", data: [] };
  }
}
