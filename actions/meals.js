"use server";

import { prisma, withTransaction } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { guardAction } from "@/lib/guards";
import { MEALS, DIET_LABELS, mealCutoff, isOrderOpen, allowedForDiet, standardMeal } from "@/lib/diet/meals";
import { istDateString } from "@/lib/dates";
import { fmtTime } from "@/lib/format";

const DIETS = Object.keys(DIET_LABELS);
const MEAL_KEYS = MEALS.map((m) => m.key);
const SERVERS = ["WARD_ATTENDANT", "KITCHEN", "NURSE", "ADMIN", "SUPER_ADMIN"];
const INTAKE_ROLES = ["NURSE", "ADMIN", "SUPER_ADMIN"];
const mealLabel = (key) => MEALS.find((m) => m.key === key)?.label ?? key;

function failed(error, fallback) {
  if (error.message === "Unauthorized") return { success: false, message: "Unauthorized" };
  if (error.message === "Forbidden") return { success: false, message: "You do not have permission to do this" };
  if (error.message === "Service temporarily unavailable") return { success: false, message: "Database connection error. Please try again." };
  console.error(`${fallback}:`, error);
  return { success: false, message: fallback };
}

const refresh = (admissionId) => {
  revalidatePath("/kitchen");
  revalidatePath("/my-meals");
  if (admissionId) revalidatePath(`/admissions/${admissionId}`);
};

/** Load a stay the current user may order for: patients only their own. */
async function stayFor(admissionId, user, role) {
  const a = await prisma.admission.findUnique({
    where: { id: admissionId },
    select: { id: true, status: true, dietType: true, dietNotes: true, patient: { select: { userId: true, allergies: true } } },
  });
  if (!a || (role === "PATIENT" && a.patient.userId !== user.id)) return null;
  return a;
}

// ─── Diet ───────────────────────────────────────────────────────────────────

export async function setDiet(admissionId, { dietType, notes } = {}) {
  try {
    const { user } = await guardAction("diet", "update");
    if (!DIETS.includes(dietType)) return { success: false, message: "Choose a diet" };
    const a = await prisma.admission.findUnique({ where: { id: admissionId }, select: { status: true } });
    if (!a) return { success: false, message: "Admission not found" };
    if (a.status !== "ADMITTED") return { success: false, message: "This patient has been discharged" };
    await prisma.admission.update({
      where: { id: admissionId },
      data: { dietType, dietNotes: notes?.trim() || null, dietUpdatedAt: new Date(), dietUpdatedById: user.id },
    });
    refresh(admissionId);
    return { success: true, message: dietType === "NIL_BY_MOUTH" ? "Nil by mouth — kitchen and ward told not to serve food" : `Diet set to ${DIET_LABELS[dietType].toLowerCase()}` };
  } catch (error) {
    return failed(error, "Failed to set the diet");
  }
}

// ─── Menu ───────────────────────────────────────────────────────────────────

export async function saveMenuItem(data = {}) {
  try {
    await guardAction("menu", data.id ? "update" : "create");
    const name = data.name?.trim();
    if (!name) return { success: false, message: "Enter the dish name" };
    if (!MEAL_KEYS.includes(data.meal)) return { success: false, message: "Choose the meal" };
    const diets = (data.diets ?? []).filter((d) => DIETS.includes(d) && d !== "NIL_BY_MOUTH");
    if (!diets.length) return { success: false, message: "Choose at least one diet this dish suits" };
    const price = Number(data.price ?? 0);
    if (!Number.isFinite(price) || price < 0) return { success: false, message: "Enter a valid price" };
    if (data.isExtra && price <= 0) return { success: false, message: "Extras need a price" };
    const clash = await prisma.menuItem.findFirst({ where: { name: { equals: name, mode: "insensitive" }, meal: data.meal, ...(data.id ? { id: { not: data.id } } : {}) }, select: { id: true } });
    if (clash) return { success: false, message: `${name} is already on the ${mealLabel(data.meal).toLowerCase()} menu` };
    const values = { name, meal: data.meal, diets, vegetarian: data.vegetarian ?? true, isExtra: Boolean(data.isExtra), price: data.isExtra ? price : 0, description: data.description?.trim() || null, active: data.active ?? true };
    const item = data.id ? await prisma.menuItem.update({ where: { id: data.id }, data: values }) : await prisma.menuItem.create({ data: values });
    revalidatePath("/kitchen/menu");
    return { success: true, message: `${name} saved`, data: item };
  } catch (error) {
    return failed(error, "Failed to save the dish");
  }
}

export async function getMenu() {
  try {
    await guardAction("menu", "read");
    const items = await prisma.menuItem.findMany({ orderBy: [{ meal: "asc" }, { isExtra: "asc" }, { name: "asc" }] });
    return { success: true, data: items };
  } catch (error) {
    return failed(error, "Failed to load the menu");
  }
}

/** Dishes this patient may choose for one meal, plus whether ordering is still open and any existing choice. */
export async function getMenuFor(admissionId, { date, meal } = {}) {
  try {
    const { user, role } = await guardAction("meals", "read");
    const stay = await stayFor(admissionId, user, role);
    if (!stay) return { success: false, message: "Admission not found" };
    const items = await prisma.menuItem.findMany({ where: { meal, active: true, diets: { has: stay.dietType } }, orderBy: [{ isExtra: "asc" }, { name: "asc" }] });
    const order = await prisma.mealOrder.findUnique({ where: { admissionId_date_meal: { admissionId, date, meal } } });
    return {
      success: true,
      data: {
        dietType: stay.dietType, dietNotes: stay.dietNotes,
        open: stay.dietType !== "NIL_BY_MOUTH" && isOrderOpen(date, meal),
        cutoff: mealCutoff(date, meal),
        items: stay.dietType === "NIL_BY_MOUTH" ? [] : items,
        order,
      },
    };
  } catch (error) {
    return failed(error, "Failed to load the menu");
  }
}

export async function placeMealOrder(admissionId, { date, meal, items = [], notes } = {}) {
  try {
    const { user, role } = await guardAction("meals", "create");
    const stay = await stayFor(admissionId, user, role);
    if (!stay) return { success: false, message: "Admission not found" };
    if (stay.status !== "ADMITTED") return { success: false, message: "This patient has been discharged" };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "") || !MEAL_KEYS.includes(meal)) return { success: false, message: "Choose the day and meal" };
    if (stay.dietType === "NIL_BY_MOUTH") return { success: false, message: "Nil by mouth — no food or drink. Ask your nurse." };
    const def = MEALS.find((m) => m.key === meal);
    if (!isOrderOpen(date, meal)) {
      return { success: false, message: `Ordering for ${def.label.toLowerCase()} closed at ${def.cutoff}${def.cutoffDayBefore ? " the evening before" : ""}` };
    }
    if (!items.length) return { success: false, message: "Choose at least one dish" };

    const dishes = await prisma.menuItem.findMany({ where: { id: { in: items.map((i) => i.menuItemId) }, active: true } });
    const lines = [];
    for (const it of items) {
      const d = dishes.find((x) => x.id === it.menuItemId);
      if (!d) return { success: false, message: "One of the dishes is no longer available" };
      if (d.meal !== meal) return { success: false, message: `${d.name} is not on the ${def.label.toLowerCase()} menu` };
      if (!allowedForDiet(d, stay.dietType)) return { success: false, message: `${d.name} is not allowed on a ${DIET_LABELS[stay.dietType].toLowerCase()} diet` };
      const quantity = Math.min(3, Math.max(1, Number(it.quantity) || 1));
      lines.push({ menuItemId: d.id, name: d.name, quantity, isExtra: d.isExtra, price: d.price });
    }

    const existing = await prisma.mealOrder.findUnique({ where: { admissionId_date_meal: { admissionId, date, meal } }, select: { status: true } });
    if (existing?.status === "DELIVERED") return { success: false, message: "Already delivered" };
    const data = { items: lines, notes: notes?.trim() || null, status: "ORDERED", byPatient: role === "PATIENT", orderedById: user.id };
    await prisma.mealOrder.upsert({
      where: { admissionId_date_meal: { admissionId, date, meal } },
      create: { admissionId, date, meal, ...data },
      update: data,
    });
    refresh(admissionId);
    return { success: true, message: `${def.label} for ${date === istDateString() ? "today" : date} ${existing ? "updated" : "ordered"}` };
  } catch (error) {
    return failed(error, "Failed to place the order");
  }
}

// ─── Kitchen and wards ──────────────────────────────────────────────────────

const serveText = (items) => items.map((i) => `${i.quantity > 1 ? `${i.quantity} × ` : ""}${i.name}`).join(", ");

/** One meal's list for the kitchen and ward: every in-patient, what to serve, and how much of each dish to prepare. */
export async function getKitchenList({ date = istDateString(), meal = "LUNCH" } = {}) {
  try {
    const { role } = await guardAction("meals", "read");
    if (role === "PATIENT") return { success: false, message: "Not available" };
    const stays = await prisma.admission.findMany({
      where: { status: "ADMITTED" },
      select: {
        id: true, dietType: true, dietNotes: true,
        patient: { select: { firstName: true, lastName: true, uhid: true, allergies: true } },
        bed: { select: { bedNumber: true, ward: { select: { name: true, floor: true } } } },
        mealOrders: { where: { date, meal } },
      },
      orderBy: [{ bed: { ward: { floor: "asc" } } }, { bed: { ward: { name: "asc" } } }, { bed: { bedNumber: "asc" } }],
    });
    const prep = new Map();
    const add = (name, q) => prep.set(name, (prep.get(name) ?? 0) + q);
    const rows = stays.map((s) => {
      const order = s.mealOrders[0] ?? null;
      const nbm = s.dietType === "NIL_BY_MOUTH";
      let serve;
      if (nbm) serve = standardMeal("NIL_BY_MOUTH", meal);
      else if (order) {
        serve = serveText(order.items);
        order.items.forEach((i) => add(i.name, i.quantity));
      } else {
        serve = standardMeal(s.dietType, meal);
        add(serve, 1);
      }
      return {
        admissionId: s.id, bedNumber: s.bed.bedNumber, ward: s.bed.ward.name,
        patientName: `${s.patient.firstName} ${s.patient.lastName}`.trim(), uhid: s.patient.uhid, allergies: s.patient.allergies,
        dietType: s.dietType, dietNotes: s.dietNotes, serve, nilByMouth: nbm,
        orderId: order?.id ?? null, notes: order?.notes ?? null, byPatient: order?.byPatient ?? false,
        status: order?.status ?? (nbm ? "NOT_SERVED" : "STANDARD"), deliveredAt: order?.deliveredAt ?? null, intake: order?.intake ?? null,
      };
    });
    const def = MEALS.find((m) => m.key === meal);
    return {
      success: true,
      data: { date, meal, label: def.label, serve: def.serve, cutoff: mealCutoff(date, meal), open: isOrderOpen(date, meal), rows, prep: [...prep].map(([name, quantity]) => ({ name, quantity })) },
    };
  } catch (error) {
    return failed(error, "Failed to load the kitchen list");
  }
}

async function postExtras(tx, order, userId) {
  const extras = (order.items ?? []).filter((i) => i.isExtra && i.price > 0);
  if (!extras.length || order.admission.status !== "ADMITTED" || order.admission.billFinalizedAt) return;
  for (const e of extras) {
    await tx.admissionCharge.create({
      data: { admissionId: order.admissionId, description: `Meal extra: ${e.name}`, category: "DIETARY", quantity: e.quantity, unitPrice: e.price, gstRate: 0, postedById: userId },
    });
  }
}

export async function markDelivered(orderId) {
  try {
    const { user, role } = await guardAction("meals", "update");
    if (!SERVERS.includes(role)) return { success: false, message: "Only ward and kitchen staff deliver meals" };
    const order = await prisma.mealOrder.findUnique({ where: { id: orderId }, include: { admission: { select: { status: true, billFinalizedAt: true, dietType: true } } } });
    if (!order) return { success: false, message: "Order not found" };
    if (order.status === "DELIVERED") return { success: false, message: "Already delivered" };
    if (order.date > istDateString()) return { success: false, message: "This meal is for a later day" };
    if (order.admission.dietType === "NIL_BY_MOUTH") return { success: false, message: "Patient is nil by mouth — do not serve" };
    await withTransaction(async (tx) => {
      await tx.mealOrder.update({ where: { id: orderId }, data: { status: "DELIVERED", deliveredAt: new Date(), deliveredById: user.id } });
      await postExtras(tx, order, user.id);
    });
    refresh(order.admissionId);
    return { success: true, message: `${mealLabel(order.meal)} delivered` };
  } catch (error) {
    return failed(error, "Failed to mark delivered");
  }
}

/** Deliver the standard meal to a patient who did not choose. */
export async function deliverStandardMeal(admissionId, { date, meal } = {}) {
  try {
    const { user, role } = await guardAction("meals", "update");
    if (!SERVERS.includes(role)) return { success: false, message: "Only ward and kitchen staff deliver meals" };
    const a = await prisma.admission.findUnique({ where: { id: admissionId }, select: { status: true, dietType: true } });
    if (!a || a.status !== "ADMITTED") return { success: false, message: "Admission not found" };
    if (a.dietType === "NIL_BY_MOUTH") return { success: false, message: "Patient is nil by mouth — do not serve" };
    if (date > istDateString()) return { success: false, message: "This meal is for a later day" };
    const existing = await prisma.mealOrder.findUnique({ where: { admissionId_date_meal: { admissionId, date, meal } } });
    if (existing) return markDelivered(existing.id);
    await prisma.mealOrder.create({
      data: { admissionId, date, meal, items: [{ name: standardMeal(a.dietType, meal), quantity: 1, isExtra: false, price: 0 }], status: "DELIVERED", deliveredAt: new Date(), deliveredById: user.id, orderedById: user.id },
    });
    refresh(admissionId);
    return { success: true, message: `${mealLabel(meal)} delivered` };
  } catch (error) {
    return failed(error, "Failed to mark delivered");
  }
}

export async function recordIntake(orderId, intake) {
  try {
    const { user, role } = await guardAction("meals", "update");
    if (!INTAKE_ROLES.includes(role)) return { success: false, message: "Nurses record how much was eaten" };
    if (!["FULL", "HALF", "LITTLE", "NONE"].includes(intake)) return { success: false, message: "Choose how much was eaten" };
    const order = await prisma.mealOrder.findUnique({ where: { id: orderId }, select: { status: true, admissionId: true } });
    if (!order) return { success: false, message: "Order not found" };
    if (order.status !== "DELIVERED") return { success: false, message: "Deliver the meal first" };
    await prisma.mealOrder.update({ where: { id: orderId }, data: { intake, intakeAt: new Date(), intakeRecordedById: user.id } });
    refresh(order.admissionId);
    return { success: true, message: "Intake recorded" };
  } catch (error) {
    return failed(error, "Failed to record intake");
  }
}

function mealDays(stay) {
  const now = new Date();
  const dates = [0, 1, 2].map((d) => istDateString(new Date(now.getTime() + d * 86400000)));
  return {
    admissionId: stay.id, dietType: stay.dietType, dietNotes: stay.dietNotes, bedNumber: stay.bed.bedNumber,
    days: dates.map((date) => ({
      date,
      meals: MEALS.map((m) => ({
        meal: m.key, label: m.label, serve: m.serve,
        cutoff: mealCutoff(date, m.key), cutoffText: `${m.cutoffDayBefore ? "previous evening " : ""}${fmtTime(mealCutoff(date, m.key))}`,
        open: stay.dietType !== "NIL_BY_MOUTH" && isOrderOpen(date, m.key, now),
        order: stay.mealOrders.find((o) => o.date === date && o.meal === m.key) ?? null,
      })),
    })),
  };
}

const STAY_MEALS = { id: true, dietType: true, dietNotes: true, bed: { select: { bedNumber: true } }, mealOrders: true };

/** Patient's own meals for today and the next two days. */
export async function getMyMeals() {
  try {
    const { user } = await guardAction("meals", "create");
    const stay = await prisma.admission.findFirst({ where: { status: "ADMITTED", patient: { userId: user.id } }, select: STAY_MEALS });
    return { success: true, data: stay ? mealDays(stay) : null };
  } catch (error) {
    return failed(error, "Failed to load your meals");
  }
}

/** Meals for one in-patient stay, for the ward and doctor. */
export async function getStayMeals(admissionId) {
  try {
    const { role } = await guardAction("meals", "read");
    if (role === "PATIENT") return { success: false, message: "Not available" };
    const stay = await prisma.admission.findUnique({ where: { id: admissionId }, select: STAY_MEALS });
    if (!stay) return { success: false, message: "Admission not found" };
    return { success: true, data: mealDays(stay) };
  } catch (error) {
    return failed(error, "Failed to load meals");
  }
}
