import { describe, it, expect } from "vitest";
import { MEALS, mealCutoff, isOrderOpen, allowedForDiet, standardMeal, DIET_LABELS } from "@/lib/diet/meals";

describe("meal cut-off times (Indian time)", () => {
  it("closes breakfast at 8 pm the evening before, other meals the same day", () => {
    expect(mealCutoff("2026-10-26", "BREAKFAST").toISOString()).toBe("2026-10-25T14:30:00.000Z");
    expect(mealCutoff("2026-10-26", "LUNCH").toISOString()).toBe("2026-10-26T04:30:00.000Z");
    expect(mealCutoff("2026-10-26", "SNACKS").toISOString()).toBe("2026-10-26T08:30:00.000Z");
    expect(mealCutoff("2026-10-26", "DINNER").toISOString()).toBe("2026-10-26T10:30:00.000Z");
  });

  it("is open only before the cut-off", () => {
    expect(isOrderOpen("2026-10-26", "LUNCH", new Date("2026-10-26T09:59:00+05:30"))).toBe(true);
    expect(isOrderOpen("2026-10-26", "LUNCH", new Date("2026-10-26T10:00:00+05:30"))).toBe(false);
    expect(isOrderOpen("2026-10-26", "BREAKFAST", new Date("2026-10-25T21:00:00+05:30"))).toBe(false);
  });

  it("lists meals in serving order", () => {
    expect(MEALS.map((m) => m.key)).toEqual(["BREAKFAST", "LUNCH", "SNACKS", "DINNER"]);
  });
});

describe("diet rules", () => {
  const diabeticThali = { diets: ["DIABETIC"] };
  const kheer = { diets: ["NORMAL", "SOFT"] };
  it("allows only dishes marked for the patient's diet", () => {
    expect(allowedForDiet(diabeticThali, "DIABETIC")).toBe(true);
    expect(allowedForDiet(kheer, "DIABETIC")).toBe(false);
  });
  it("never allows anything when the patient is nil by mouth", () => {
    expect(allowedForDiet({ diets: ["NIL_BY_MOUTH", "NORMAL"] }, "NIL_BY_MOUTH")).toBe(false);
  });
  it("names the standard meal the kitchen sends when nothing was chosen", () => {
    expect(standardMeal("DIABETIC", "LUNCH")).toBe("Standard diabetic lunch");
    expect(standardMeal("NIL_BY_MOUTH", "LUNCH")).toBe("Nil by mouth — do not serve");
    expect(DIET_LABELS.LOW_SALT).toBe("Low salt");
  });
});
