import { notFound, redirect } from "next/navigation";
import { guardPage } from "@/lib/guards";
import { canCreate, canRead, canUpdate } from "@/lib/permissions";
import { getAdmission } from "@/actions/admissions";
import { getAdmissionBill, getTariffs } from "@/actions/ipd-billing";
import { getMedicationChart } from "@/actions/medication-orders";
import { getFormulary } from "@/actions/pharmacy";
import { getLabResults, getLabCatalog } from "@/actions/lab";
import { getStayMeals } from "@/actions/meals";
import { AdmissionChart } from "@/components/inpatient/admission-chart";

export const metadata = { title: "In-Patient Chart | Smart Hospital" };

export default async function AdmissionPage({ params }) {
  const guard = await guardPage("admissions", "read");
  if (!guard.authorized) redirect(guard.status === 403 ? "/forbidden" : "/sign-in");
  const { id } = await params;
  const result = await getAdmission(id);
  if (!result.success) notFound();

  const seesBilling = guard.role !== "PATIENT" && canRead("billing", guard.role);
  const [bill, tariffs] = seesBilling
    ? await Promise.all([getAdmissionBill(id), canCreate("billing", guard.role) ? getTariffs({ activeOnly: true }) : null])
    : [null, null];
  const isStaff = guard.role !== "PATIENT";
  const meals = isStaff && canRead("meals", guard.role) ? await getStayMeals(id) : null;
  const [labResults, labCatalog] = isStaff
    ? await Promise.all([getLabResults({ admissionId: id }), canCreate("labOrders", guard.role) ? getLabCatalog() : null])
    : [null, null];
  const [medChart, formulary] = isStaff
    ? await Promise.all([getMedicationChart(id), canCreate("medicationOrders", guard.role) ? getFormulary({ activeOnly: true }) : null])
    : [null, null];

  return (
    <AdmissionChart
      admission={result.data}
      viewer={{
        id: guard.user.id,
        role: guard.role,
        canChart: canCreate("nursing", guard.role),
        canDischarge: canUpdate("admissions", guard.role),
        isPatient: guard.role === "PATIENT",
        canPostCharges: canCreate("billing", guard.role),
        canFinalizeBill: canUpdate("billing", guard.role),
        canEditPayer: canUpdate("insurance", guard.role),
        canWorkInsurance: canCreate("insurance", guard.role),
        canOrderMedicines: canCreate("medicationOrders", guard.role),
        canEditAllergies: canCreate("nursing", guard.role) || canUpdate("patients", guard.role),
        canOrderTests: canCreate("labOrders", guard.role),
        canCollectSamples: canUpdate("labOrders", guard.role),
        canAckCritical: ["DOCTOR", "NURSE", "ADMIN", "SUPER_ADMIN"].includes(guard.role),
        canSetDiet: canUpdate("diet", guard.role),
        canRecordIntake: ["NURSE", "ADMIN", "SUPER_ADMIN"].includes(guard.role),
        canTransferBed: canUpdate("beds", guard.role),
      }}
      meals={meals?.success ? meals.data : null}
      labResults={labResults?.success ? labResults.data : null}
      labCatalog={labCatalog?.success ? labCatalog.data : []}
      medChart={medChart?.success ? medChart.data : null}
      formulary={formulary?.success ? formulary.data : []}
      bill={bill?.success ? bill.data : null}
      tariffs={tariffs?.success ? tariffs.data : []}
    />
  );
}
