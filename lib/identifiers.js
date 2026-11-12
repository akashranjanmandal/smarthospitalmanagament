export const UHID_PREFIX = process.env.UHID_PREFIX || "SHDS";

export function formatUhid(n, prefix = UHID_PREFIX) {
  return `${prefix}-${String(n).padStart(8, "0")}`;
}

export function formatAdmissionNumber(year, n) {
  return `IP-${year}-${String(n).padStart(6, "0")}`;
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const istDayNumber = (d) => Math.floor((new Date(d).getTime() + IST_OFFSET_MS) / 86400000);

// Hospital day of stay by Indian calendar date: the admission day is day 1, the next date day 2.
export function lengthOfStayDays(admittedAt, until = new Date()) {
  return Math.max(1, istDayNumber(until) - istDayNumber(admittedAt) + 1);
}
