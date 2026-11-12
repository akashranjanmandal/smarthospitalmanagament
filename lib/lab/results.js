// Result flags used on lab reports: N normal, H/L outside the reference range, HH/LL critical, A abnormal (qualitative).
export function flagValue(param, value) {
  if (param.type === "choice") return (param.abnormal ?? []).includes(value) ? "A" : "N";
  const v = Number(value);
  if (param.criticalLow != null && v < param.criticalLow) return "LL";
  if (param.criticalHigh != null && v > param.criticalHigh) return "HH";
  if (param.low != null && v < param.low) return "L";
  if (param.high != null && v > param.high) return "H";
  return "N";
}

export function formatRange(param) {
  if (param.type === "choice") return (param.options ?? []).filter((o) => !(param.abnormal ?? []).includes(o)).join(" / ");
  if (param.low != null && param.high != null) return `${param.low} – ${param.high}`;
  if (param.high != null) return `< ${param.high}`;
  if (param.low != null) return `> ${param.low}`;
  return "";
}

/** Validate entered values against the test's parameters and flag each one. */
export function evaluateResults(parameters, values = {}) {
  const results = [];
  for (const p of parameters) {
    const raw = values[p.name];
    if (raw === undefined || raw === null || String(raw).trim() === "") return { ok: false, message: `Enter a result for ${p.name}` };
    if (p.type === "choice") {
      if (!(p.options ?? []).includes(raw)) return { ok: false, message: `${p.name} must be one of: ${p.options.join(", ")}` };
      results.push({ name: p.name, value: raw, unit: p.unit ?? "", range: formatRange(p), flag: flagValue(p, raw) });
    } else {
      const n = Number(raw);
      if (!Number.isFinite(n)) return { ok: false, message: `${p.name} must be a number` };
      results.push({ name: p.name, value: n, unit: p.unit ?? "", range: formatRange(p), flag: flagValue(p, n) });
    }
  }
  return {
    ok: true,
    critical: results.some((r) => r.flag === "HH" || r.flag === "LL"),
    abnormal: results.some((r) => r.flag !== "N"),
    results,
  };
}
