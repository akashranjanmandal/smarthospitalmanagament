import { prisma } from "@/lib/prisma";
import { nextSequence } from "@/lib/audit/extension";

/** Find formulary medicines by brand name (case-insensitive); unknown names stay unmatched for the pharmacist. */
export async function matchFormulary(names) {
  const found = await prisma.medicine.findMany({
    where: { active: true, OR: names.map((n) => ({ name: { equals: String(n).trim(), mode: "insensitive" } })) },
  });
  const byName = new Map(found.map((m) => [m.name.toLowerCase(), m]));
  return names.map((n) => byName.get(String(n).trim().toLowerCase()) ?? null);
}

/** Create a pharmacy order (OPD prescription or IPD ward indent) with an RX number. */
export async function createPharmacyOrder({ source, patientId, prescriptionId = null, admissionId = null, medicationOrderId = null, items }) {
  const year = new Date().getFullYear();
  const orderNumber = `RX-${year}-${String(await nextSequence(prisma, `rx-${year}`)).padStart(6, "0")}`;
  return prisma.pharmacyOrder.create({
    data: {
      orderNumber, source, patientId, prescriptionId, admissionId, medicationOrderId,
      items: { create: items.map((i) => ({ medicineId: i.medicineId ?? null, name: i.name, dose: i.dose ?? null, frequency: i.frequency ?? null, duration: i.duration ?? null, quantity: i.quantity })) },
    },
    select: { id: true, orderNumber: true },
  });
}
