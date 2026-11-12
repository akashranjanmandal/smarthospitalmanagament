import { describe, it, expect } from "vitest";
import { passwordStrength } from "@/lib/password-strength";

describe("passwordStrength", () => {
  it("rejects anything shorter than the 6-character minimum", () => {
    expect(passwordStrength("abc12")).toMatchObject({ ok: false, label: "Too short" });
    expect(passwordStrength("")).toMatchObject({ ok: false, score: 0 });
  });

  it("grades acceptable passwords from weak to strong", () => {
    expect(passwordStrength("abcdef")).toMatchObject({ ok: true, label: "Weak", score: 1 });
    expect(passwordStrength("abcdef12")).toMatchObject({ label: "Fair", score: 2 });
    expect(passwordStrength("Abcdef12")).toMatchObject({ label: "Good", score: 3 });
    expect(passwordStrength("Abcdef12!x")).toMatchObject({ label: "Strong", score: 4 });
  });
});
