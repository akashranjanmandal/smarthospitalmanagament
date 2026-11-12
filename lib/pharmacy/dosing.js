// How often and how much: turns prescription wording into numbers the pharmacy and ward can act on.
const ABBREVIATIONS = { OD: 1, QD: 1, HS: 1, BD: 2, BID: 2, TDS: 3, TID: 3, QID: 4, SOS: 0, PRN: 0, STAT: 1 };
const TIMES = { OD: ["09:00"], QD: ["09:00"], HS: ["21:00"], BD: ["09:00", "21:00"], BID: ["09:00", "21:00"], TDS: ["08:00", "14:00", "20:00"], TID: ["08:00", "14:00", "20:00"], QID: ["06:00", "12:00", "18:00", "00:00"] };

export function dosesPerDay(frequency = "") {
  const f = String(frequency).trim();
  const upper = f.toUpperCase();
  if (upper in ABBREVIATIONS) return ABBREVIATIONS[upper];
  // Indian prescription notation: morning-afternoon-night, e.g. 1-0-1 or 1/2-0-1/2
  if (/^[\d/.½]+(-[\d/.½]+){2,3}$/.test(f)) return f.split("-").filter((p) => p !== "0").length;
  const lower = f.toLowerCase();
  if (/(four|4) times/.test(lower)) return 4;
  if (/(three|3) times|thrice/.test(lower)) return 3;
  if (/(two|2) times|twice/.test(lower)) return 2;
  if (/once|daily|at night|morning/.test(lower)) return 1;
  if (/as needed|when required|if needed|sos/.test(lower)) return 0;
  return 1;
}

export function durationDays(duration = "") {
  const m = String(duration).toLowerCase().match(/(\d+)\s*(day|days|d|week|weeks|w|month|months|m)?/);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2] ?? "day";
  return unit.startsWith("w") ? n * 7 : unit.startsWith("m") ? n * 30 : n;
}

/** Units to dispense. SOS/as-needed gives one per day of the course; unknown duration gives one day's supply. */
export function quantityFor({ frequency, duration, perDose = 1 }) {
  const days = durationDays(duration) ?? 1;
  const perDay = dosesPerDay(frequency);
  return Math.max(1, Math.ceil((perDay === 0 ? 1 : perDay) * days * perDose));
}

/** Clock times at which a ward dose is due (empty for as-needed medicines). */
export function doseTimes(frequency = "") {
  const upper = String(frequency).trim().toUpperCase();
  if (TIMES[upper]) return TIMES[upper];
  const n = dosesPerDay(frequency);
  return { 1: TIMES.OD, 2: TIMES.BD, 3: TIMES.TDS, 4: TIMES.QID }[n] ?? [];
}
