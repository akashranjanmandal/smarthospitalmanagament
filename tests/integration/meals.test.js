import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { admitPatient } from "@/actions/admissions";
import { getAdmissionBill } from "@/actions/ipd-billing";
import { setDiet, saveMenuItem, getMenuFor, placeMealOrder, getKitchenList, markDelivered, recordIntake, getMyMeals } from "@/actions/meals";
import { seedWard, createUser } from "../helpers/db";
import { loginAs } from "../helpers/cookie-jar";
import { istDateString } from "@/lib/dates";

const day = (offset) => istDateString(new Date(Date.now() + offset * 86400000));
let h, kitchen, admission, other, thali, diabeticThali, juice, eggs;

beforeEach(async () => {
  h = await seedWard();
  kitchen = await createUser({ role: "KITCHEN", firstName: "Meena", lastName: "Cook" });
  await loginAs(kitchen);
  thali = (await saveMenuItem({ name: "Veg thali", meal: "LUNCH", diets: ["NORMAL", "LOW_SALT"], vegetarian: true })).data;
  diabeticThali = (await saveMenuItem({ name: "Diabetic thali", meal: "LUNCH", diets: ["DIABETIC"], vegetarian: true })).data;
  juice = (await saveMenuItem({ name: "Fresh lime juice", meal: "LUNCH", diets: ["NORMAL", "LIQUID"], isExtra: true, price: 60 })).data;
  eggs = (await saveMenuItem({ name: "Boiled eggs", meal: "BREAKFAST", diets: ["NORMAL", "DIABETIC"], vegetarian: false })).data;
  await loginAs(h.receptionist);
  admission = (await admitPatient({ patientId: h.p1.patient.id, bedId: h.beds[0].id, departmentId: h.dept.id, doctorId: h.doctor.id, reason: "Fever" })).data;
  other = (await admitPatient({ patientId: h.p2.patient.id, bedId: h.beds[1].id, departmentId: h.dept.id, doctorId: h.doctor.id, reason: "Chest pain" })).data;
});

describe("diet orders", () => {
  it("start as normal and are changed only by the doctor", async () => {
    expect((await prisma.admission.findUnique({ where: { id: admission.id } })).dietType).toBe("NORMAL");
    await loginAs(h.nurse);
    expect((await setDiet(admission.id, { dietType: "DIABETIC" })).success).toBe(false);
    await loginAs(h.doctorUser);
    expect((await setDiet(admission.id, { dietType: "DIABETIC", notes: "1800 kcal" })).success).toBe(true);
    expect(await prisma.admission.findUnique({ where: { id: admission.id } })).toMatchObject({ dietType: "DIABETIC", dietNotes: "1800 kcal" });
  });
});

describe("choosing meals", () => {
  it("shows the patient only dishes allowed for their diet", async () => {
    await loginAs(h.doctorUser);
    await setDiet(admission.id, { dietType: "DIABETIC" });
    await loginAs(h.p1.user);
    const { data } = await getMenuFor(admission.id, { date: day(1), meal: "LUNCH" });
    expect(data.items.map((i) => i.name)).toEqual(["Diabetic thali"]);
    expect(data).toMatchObject({ open: true, dietType: "DIABETIC" });
  });

  it("lets the patient order for themselves before the cut-off, and change it", async () => {
    await loginAs(h.p1.user);
    expect((await placeMealOrder(admission.id, { date: day(1), meal: "LUNCH", items: [{ menuItemId: thali.id, quantity: 1 }] })).success).toBe(true);
    expect((await placeMealOrder(admission.id, { date: day(1), meal: "LUNCH", items: [{ menuItemId: thali.id }, { menuItemId: juice.id }], notes: "Less spicy" })).success).toBe(true);
    const orders = await prisma.mealOrder.findMany({ where: { admissionId: admission.id } });
    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({ byPatient: true, notes: "Less spicy" });
    expect(orders[0].items.map((i) => i.name)).toEqual(["Veg thali", "Fresh lime juice"]);
  });

  it("refuses dishes outside the diet, closed meals, nil by mouth, and other patients' stays", async () => {
    await loginAs(h.doctorUser);
    await setDiet(admission.id, { dietType: "DIABETIC" });
    await loginAs(h.p1.user);
    expect(await placeMealOrder(admission.id, { date: day(1), meal: "LUNCH", items: [{ menuItemId: thali.id }] })).toMatchObject({ success: false, message: "Veg thali is not allowed on a diabetic diet" });
    expect(await placeMealOrder(admission.id, { date: day(-1), meal: "LUNCH", items: [{ menuItemId: diabeticThali.id }] })).toMatchObject({ success: false, message: "Ordering for lunch closed at 10:00" });
    expect((await placeMealOrder(other.id, { date: day(1), meal: "LUNCH", items: [{ menuItemId: thali.id }] })).success).toBe(false);

    await loginAs(h.doctorUser);
    await setDiet(admission.id, { dietType: "NIL_BY_MOUTH", notes: "Surgery tomorrow" });
    await loginAs(h.p1.user);
    expect(await placeMealOrder(admission.id, { date: day(1), meal: "LUNCH", items: [{ menuItemId: diabeticThali.id }] })).toMatchObject({ success: false, message: "Nil by mouth — no food or drink. Ask your nurse." });
  });

  it("can be placed by a nurse on the patient's behalf", async () => {
    await loginAs(h.nurse);
    expect((await placeMealOrder(admission.id, { date: day(2), meal: "BREAKFAST", items: [{ menuItemId: eggs.id, quantity: 2 }] })).success).toBe(true);
    expect((await prisma.mealOrder.findFirst())).toMatchObject({ byPatient: false, orderedById: h.nurse.id });
  });
});

describe("kitchen, delivery and intake", () => {
  beforeEach(async () => {
    await loginAs(h.doctorUser);
    await setDiet(other.id, { dietType: "NIL_BY_MOUTH" });
    await loginAs(h.p1.user);
    await placeMealOrder(admission.id, { date: day(1), meal: "LUNCH", items: [{ menuItemId: thali.id, quantity: 2 }, { menuItemId: juice.id }] });
  });

  it("gives the kitchen every in-patient with their diet, choice or standard meal, and a preparation count", async () => {
    await loginAs(kitchen);
    const { data } = await getKitchenList({ date: day(1), meal: "LUNCH" });
    expect(data.rows.map((r) => [r.bedNumber, r.dietType, r.serve])).toEqual([
      ["GW-01", "NORMAL", "2 × Veg thali, Fresh lime juice"],
      ["GW-02", "NIL_BY_MOUTH", "Nil by mouth — do not serve"],
    ]);
    expect(data.prep).toEqual([{ name: "Veg thali", quantity: 2 }, { name: "Fresh lime juice", quantity: 1 }]);
  });

  it("lists patients who did not choose against the standard meal for their diet", async () => {
    await loginAs(kitchen);
    const { data } = await getKitchenList({ date: day(1), meal: "DINNER" });
    expect(data.rows[0]).toMatchObject({ bedNumber: "GW-01", serve: "Standard normal dinner", orderId: null });
    expect(data.prep).toEqual([{ name: "Standard normal dinner", quantity: 1 }]);
  });

  it("cannot be delivered before the day it is for", async () => {
    const order = await prisma.mealOrder.findFirst();
    await loginAs(h.attendant);
    expect(await markDelivered(order.id)).toMatchObject({ success: false, message: "This meal is for a later day" });
  });

  it("is delivered by the ward attendant, extras billed, and intake recorded by the nurse", async () => {
    const order = await prisma.mealOrder.findFirst();
    await prisma.mealOrder.update({ where: { id: order.id }, data: { date: day(0) } });
    await loginAs(h.attendant);
    expect((await markDelivered(order.id)).success).toBe(true);
    expect(await markDelivered(order.id)).toMatchObject({ success: false, message: "Already delivered" });
    await loginAs(h.receptionist);
    const bill = (await getAdmissionBill(admission.id)).data;
    expect(bill.lines.map((l) => [l.description, l.category, l.amount])).toEqual([["Meal extra: Fresh lime juice", "DIETARY", 60]]);

    await loginAs(h.nurse);
    expect((await recordIntake(order.id, "HALF")).success).toBe(true);
    expect((await prisma.mealOrder.findUnique({ where: { id: order.id } })).intake).toBe("HALF");
  });

  it("shows patients their own meals and diet", async () => {
    await loginAs(h.p1.user);
    const { data } = await getMyMeals();
    expect(data).toMatchObject({ admissionId: admission.id, dietType: "NORMAL" });
    expect(data.days.find((d) => d.date === day(1)).meals.find((m) => m.meal === "LUNCH").order.items).toHaveLength(2);
  });
});
