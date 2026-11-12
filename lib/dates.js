const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** "YYYY-MM-DD" for the given moment in Indian Standard Time. */
export function istDateString(at = new Date()) {
  return new Date(at.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Appointment dates are stored as UTC midnight of the calendar date ("YYYY-MM-DD"). */
export function istDayRange(dateString = istDateString()) {
  const start = new Date(`${dateString}T00:00:00.000Z`);
  return { start, end: new Date(start.getTime() + 86400000) };
}

/** Privacy on public screens: "Sanjay V." */
export function maskName(firstName = "", lastName = "") {
  return [firstName, lastName ? `${lastName[0]}.` : ""].filter(Boolean).join(" ");
}
