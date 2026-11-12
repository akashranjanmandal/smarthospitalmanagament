"use client";

import { useEffect, useState } from "react";
import { getLabCatalog, getLabResults } from "@/actions/lab";
import { ResultsList, OrderTestsForm } from "@/components/lab/results-list";
import { Panel } from "@/components/inpatient/ui";
import { useRole } from "@/hooks/use-role";

/** Tests for an OPD consultation: the doctor orders here and everyone with access sees the results. */
export function ConsultationTests({ medicalRecordId }) {
  const { role } = useRole();
  const [results, setResults] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const isDoctor = role === "DOCTOR" || role === "SUPER_ADMIN";

  useEffect(() => {
    let alive = true;
    getLabResults({ medicalRecordId }).then((r) => alive && setResults(r.success ? r.data : []));
    if (isDoctor) getLabCatalog().then((r) => alive && r.success && setCatalog(r.data));
    return () => { alive = false; };
  }, [medicalRecordId, isDoctor]);

  if (role === "PATIENT" || results === null) return null;
  return (
    <div className="space-y-4">
      {isDoctor && <OrderTestsForm target={{ medicalRecordId }} catalog={catalog} />}
      <Panel title="Lab & radiology for this consultation">
        <ResultsList results={results} canAck={["DOCTOR", "NURSE", "ADMIN", "SUPER_ADMIN"].includes(role)} empty="No tests ordered in this consultation." />
      </Panel>
    </div>
  );
}
