import { describe, it, expect } from "vitest";
import { istDateString, istDayRange, maskName } from "@/lib/dates";

describe("Indian-time dates", () => {
  it("gives the IST calendar date, which differs from UTC late at night", () => {
    expect(istDateString(new Date("2026-10-24T20:00:00Z"))).toBe("2026-10-25");
    expect(istDateString(new Date("2026-10-24T18:00:00Z"))).toBe("2026-10-24");
  });

  it("gives the stored range for one day (appointments are saved at UTC midnight of their date)", () => {
    const { start, end } = istDayRange("2026-10-24");
    expect(start.toISOString()).toBe("2026-10-24T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-10-25T00:00:00.000Z");
  });
});

describe("maskName", () => {
  it("shows first name and last initial on public screens", () => {
    expect(maskName("Sanjay", "Verma")).toBe("Sanjay V.");
    expect(maskName("Meera", "")).toBe("Meera");
  });
});
