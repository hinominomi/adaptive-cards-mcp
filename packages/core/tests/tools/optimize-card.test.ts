import { describe, it, expect } from "vitest";
import { handleOptimizeCard } from "../../src/tools/optimize-card.js";

describe("optimize_card tool", () => {
  it("adds wrap:true to TextBlocks", () => {
    const result = handleOptimizeCard({
      card: {
        type: "AdaptiveCard",
        version: "1.6",
        body: [
          { type: "TextBlock", text: "Hello World" },
        ],
      },
      goals: ["accessibility"],
    });

    const body = result.card.body as Record<string, unknown>[];
    expect(body[0].wrap).toBe(true);
    expect(result.changes.some((c) => c.description.includes("wrap:true"))).toBe(true);
  });

  it("adds altText to Images", () => {
    const result = handleOptimizeCard({
      card: {
        type: "AdaptiveCard",
        version: "1.6",
        body: [
          { type: "Image", url: "https://example.com/photo.png" },
        ],
      },
      goals: ["accessibility"],
    });

    const body = result.card.body as Record<string, unknown>[];
    expect(body[0].altText).toBeDefined();
    expect(typeof body[0].altText).toBe("string");
    expect(result.changes.some((c) => c.description.includes("altText"))).toBe(true);
  });

  it("replaces Action.Submit with Action.Execute", () => {
    const result = handleOptimizeCard({
      card: {
        type: "AdaptiveCard",
        version: "1.5",
        body: [{ type: "TextBlock", text: "Test", wrap: true }],
        actions: [
          { type: "Action.Submit", title: "Submit", data: { key: "value" } },
        ],
      },
      goals: ["modern"],
    });

    const actions = result.card.actions as Record<string, unknown>[];
    expect(actions[0].type).toBe("Action.Execute");
    expect(result.changes.some((c) => c.description.includes("Action.Submit"))).toBe(true);
  });

  it("upgrades version to 1.6", () => {
    const result = handleOptimizeCard({
      card: {
        type: "AdaptiveCard",
        version: "1.3",
        body: [{ type: "TextBlock", text: "Test", wrap: true }],
      },
      goals: ["modern"],
    });

    expect(result.card.version).toBe("1.6");
    expect(result.changes.some((c) => c.description.includes("Upgraded card version"))).toBe(true);
  });

  it("adds speak property for screen reader accessibility", () => {
    const result = handleOptimizeCard({
      card: {
        type: "AdaptiveCard",
        version: "1.6",
        body: [
          { type: "TextBlock", text: "Important Notice", wrap: true },
          { type: "TextBlock", text: "Please review your account.", wrap: true },
        ],
      },
      goals: ["accessibility"],
    });

    expect(result.card.speak).toBeDefined();
    expect(typeof result.card.speak).toBe("string");
    expect(result.changes.some((c) => c.description.includes("speak"))).toBe(true);
  });

  it("returns correct before/after metrics", () => {
    const result = handleOptimizeCard({
      card: {
        type: "AdaptiveCard",
        version: "1.3",
        body: [
          { type: "TextBlock", text: "Title" },
          { type: "Image", url: "https://example.com/img.png" },
        ],
      },
      goals: ["accessibility", "modern"],
    });

    expect(result.improvement).toBeDefined();
    expect(typeof result.improvement.accessibilityBefore).toBe("number");
    expect(typeof result.improvement.accessibilityAfter).toBe("number");
    expect(result.improvement.accessibilityAfter).toBeGreaterThanOrEqual(
      result.improvement.accessibilityBefore,
    );
    expect(typeof result.improvement.elementCountBefore).toBe("number");
    expect(typeof result.improvement.elementCountAfter).toBe("number");
  });
});
