"use server";

import { prisma } from "@/lib/prisma";
import { guardAction } from "@/lib/guards";
import { describeAuditEntry } from "@/lib/audit/format";

export async function getAuditLogs({ entity, action, actorId, search, from, to, page = 1, limit = 50 } = {}) {
  try {
    await guardAction("audit", "read");
    const where = {};
    if (entity && entity !== "all") where.entity = entity;
    if (action && action !== "all") where.action = action;
    if (actorId) where.actorId = actorId;
    if (search?.trim()) where.entityId = { contains: search.trim() };
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const take = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;
    const [rows, total, entities] = await Promise.all([
      prisma.auditLog.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip, take }),
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({ distinct: ["entity"], select: { entity: true }, orderBy: { entity: "asc" } }),
    ]);

    const actorIds = [...new Set(rows.map((r) => r.actorId).filter(Boolean))];
    const actors = actorIds.length
      ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, firstName: true, lastName: true, email: true, role: true } })
      : [];
    const byId = new Map(actors.map((a) => [a.id, a]));

    return {
      success: true,
      data: {
        logs: rows.map((r) => ({ ...r, actor: r.actorId ? byId.get(r.actorId) ?? null : null, summary: describeAuditEntry(r) })),
        total,
        page: Math.floor(skip / take) + 1,
        totalPages: Math.max(1, Math.ceil(total / take)),
        entities: entities.map((e) => e.entity),
      },
    };
  } catch (error) {
    if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
    if (error.message === "Forbidden") return { success: false, message: "Only administrators can view the activity log" };
    console.error("Get audit logs error:", error);
    return { success: false, message: "Failed to load activity log" };
  }
}
