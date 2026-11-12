import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATUSES = { VACANT: "Vacant", NEEDS_CLEANING: "Needs Cleaning" };

function renderSelect(value, valueChildren) {
  return renderToStaticMarkup(
    <Select value={value}>
      <SelectTrigger>
        <SelectValue placeholder="Status">{valueChildren}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Statuses</SelectItem>
        {Object.entries(STATUSES).map(([key, label]) => (
          <SelectItem key={key} value={key}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const valueText = (html) => html.match(/data-slot="select-value"[^>]*>(.*?)<\/span>/)?.[1];

describe("Select", () => {
  it("shows the selected item's label, not its raw value", () => {
    expect(valueText(renderSelect("all"))).toBe("All Statuses");
    expect(valueText(renderSelect("NEEDS_CLEANING"))).toBe("Needs Cleaning");
  });

  it("still lets callers render their own value text", () => {
    expect(valueText(renderSelect("VACANT", "Custom"))).toBe("Custom");
  });
});
