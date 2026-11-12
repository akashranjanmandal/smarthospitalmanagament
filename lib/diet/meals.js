// Ward meal service: serving and ordering times (IST) and diet rules. Edit MEALS to match the hospital kitchen.
export const MEALS = [
  { key: "BREAKFAST", label: "Breakfast", serve: "08:00", cutoff: "20:00", cutoffDayBefore: true },
  { key: "LUNCH", label: "Lunch", serve: "13:00", cutoff: "10:00" },
  { key: "SNACKS", label: "Evening snacks", serve: "16:30", cutoff: "14:00" },
  { key: "DINNER", label: "Dinner", serve: "20:00", cutoff: "16:00" },
];

export const DIET_LABELS = {
  NORMAL: "Normal",
  SOFT: "Soft",
  LIQUID: "Full liquid",
  CLEAR_LIQUID: "Clear liquid",
  DIABETIC: "Diabetic",
  LOW_SALT: "Low salt",
  RENAL: "Renal",
  HIGH_PROTEIN: "High protein",
  NIL_BY_MOUTH: "Nil by mouth",
};

const meal = (key) => MEALS.find((m) => m.key === key);

/** Moment ordering closes for a meal on a date ("YYYY-MM-DD", IST). */
export function mealCutoff(date, mealKey) {
  const m = meal(mealKey);
  const day = new Date(`${date}T${m.cutoff}:00+05:30`);
  if (m.cutoffDayBefore) day.setUTCDate(day.getUTCDate() - 1);
  return day;
}

export function isOrderOpen(date, mealKey, now = new Date()) {
  return now < mealCutoff(date, mealKey);
}

export function allowedForDiet(item, dietType) {
  if (dietType === "NIL_BY_MOUTH") return false;
  return (item.diets ?? []).includes(dietType);
}

export function standardMeal(dietType, mealKey) {
  if (dietType === "NIL_BY_MOUTH") return "Nil by mouth — do not serve";
  return `Standard ${DIET_LABELS[dietType].toLowerCase()} ${meal(mealKey).label.toLowerCase()}`;
}
