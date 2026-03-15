import { describe, it, expect } from "vitest";
import { handleSuggestLayout } from "../../src/tools/suggest-layout.js";

describe("suggest_layout tool", () => {
  it("suggests approval pattern for 'approval card'", () => {
    const result = handleSuggestLayout({
      description: "approval card for expense requests",
    });

    expect(result.suggestion.pattern).toBe("approval");
  });

  it("suggests data-table pattern for 'data table'", () => {
    const result = handleSuggestLayout({
      description: "data table showing employee records",
    });

    expect(result.suggestion.pattern).toBe("data-table");
  });

  it("returns alternatives array", () => {
    const result = handleSuggestLayout({
      description: "a notification card for alerts",
    });

    expect(Array.isArray(result.alternatives)).toBe(true);
    for (const alt of result.alternatives) {
      expect(alt.pattern).toBeDefined();
      expect(typeof alt.pattern).toBe("string");
      expect(alt.tradeoff).toBeDefined();
      expect(typeof alt.tradeoff).toBe("string");
    }
  });

  it("suggestion has pattern, elements, rationale", () => {
    const result = handleSuggestLayout({
      description: "a dashboard with KPI metrics",
    });

    expect(result.suggestion.pattern).toBeDefined();
    expect(typeof result.suggestion.pattern).toBe("string");
    expect(Array.isArray(result.suggestion.elements)).toBe(true);
    expect(result.suggestion.elements.length).toBeGreaterThan(0);
    expect(result.suggestion.rationale).toBeDefined();
    expect(typeof result.suggestion.rationale).toBe("string");
    expect(result.suggestion.rationale.length).toBeGreaterThan(0);
  });
});
