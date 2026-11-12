export const MIN_PASSWORD_LENGTH = 6;

const LABELS = ["Too short", "Weak", "Fair", "Good", "Strong"];

/** Score 0–4 for the sign-up meter. The server only enforces the minimum length. */
export function passwordStrength(password = "") {
  if (password.length < MIN_PASSWORD_LENGTH) return { ok: false, score: 0, label: LABELS[0] };
  let score = 1;
  if (password.length >= 8 && /\d/.test(password)) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (password.length >= 10 && /[^A-Za-z0-9]/.test(password)) score += 1;
  return { ok: true, score, label: LABELS[score] };
}
