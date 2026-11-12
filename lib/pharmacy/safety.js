// Prescribing safety checks. A starter knowledge base — the hospital's pharmacy & therapeutics committee should extend it.
const FAMILIES = {
  penicillin: ["penicillin", "amoxicillin", "ampicillin", "cloxacillin", "piperacillin", "co-amoxiclav"],
  sulfa: ["sulfamethoxazole", "cotrimoxazole", "sulfasalazine"],
  nsaid: ["ibuprofen", "diclofenac", "naproxen", "aspirin", "aceclofenac", "ketorolac", "mefenamic"],
  cephalosporin: ["cefixime", "ceftriaxone", "cefuroxime", "cephalexin", "cefpodoxime"],
  quinolone: ["ciprofloxacin", "levofloxacin", "ofloxacin", "moxifloxacin"],
};

const INTERACTIONS = [
  [["aspirin", "warfarin"], "higher bleeding risk"],
  [["clopidogrel", "warfarin"], "higher bleeding risk"],
  [["ibuprofen", "warfarin"], "higher bleeding risk"],
  [["clopidogrel", "omeprazole"], "omeprazole weakens clopidogrel"],
  [["clarithromycin", "simvastatin"], "risk of muscle damage"],
  [["sildenafil", "nitroglycerin"], "dangerous fall in blood pressure"],
  [["methotrexate", "trimethoprim"], "methotrexate toxicity"],
  [["spironolactone", "potassium chloride"], "high potassium"],
];

const lc = (s) => String(s ?? "").toLowerCase();
const generic = (d) => lc(d.genericName || d.name);
const label = (d) => d.genericName || d.name;

function allergyTerms(allergies) {
  return lc(allergies).split(/[,;\n]/).map((a) => a.trim().replace(/s$/, "")).filter(Boolean);
}

function matchesAllergy(drug, term) {
  const text = `${lc(drug.name)} ${generic(drug)}`;
  if (text.includes(term)) return true;
  const family = Object.entries(FAMILIES).find(([k]) => term.includes(k) || k.includes(term));
  return family ? family[1].some((m) => text.includes(m)) : false;
}

/** Returns warnings for new items against allergies, each other, and medicines already running. */
export function checkPrescription({ items = [], allergies = "", current = [] }) {
  const warnings = [];
  const terms = allergyTerms(allergies);
  for (const item of items) {
    const hit = terms.find((t) => matchesAllergy(item, t));
    if (hit) {
      const original = String(allergies).split(/[,;\n]/).map((a) => a.trim()).find((a) => lc(a).replace(/s$/, "") === hit) ?? hit;
      warnings.push({ type: "ALLERGY", severity: "high", message: `${item.name} — patient is allergic to ${original}` });
    }
  }

  const all = [...items.map((d) => ({ ...d, isNew: true })), ...current];
  const seen = new Set();
  for (const [[a, b], effect] of INTERACTIONS) {
    const da = all.find((d) => generic(d).includes(a));
    const db = all.find((d) => generic(d).includes(b));
    if (da && db && (da.isNew || db.isNew) && !seen.has(`${a}|${b}`)) {
      seen.add(`${a}|${b}`);
      warnings.push({ type: "INTERACTION", severity: "high", message: `${label(da)} + ${label(db)} — ${effect}` });
    }
  }

  const byGeneric = new Map();
  for (const item of items) byGeneric.set(generic(item), [...(byGeneric.get(generic(item)) ?? []), item]);
  for (const [, list] of byGeneric) {
    if (list.length > 1) warnings.push({ type: "DUPLICATE", severity: "medium", message: `${label(list[0])} is prescribed more than once (${list.map((d) => d.name).join(", ")})` });
  }
  return warnings;
}
