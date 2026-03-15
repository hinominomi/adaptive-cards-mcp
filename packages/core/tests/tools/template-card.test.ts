import { describe, it, expect } from "vitest";
import { handleTemplateCard } from "../../src/tools/template-card.js";

describe("template_card tool", () => {
  it("replaces static TextBlock text with ${expression}", () => {
    const result = handleTemplateCard({
      card: {
        type: "AdaptiveCard",
        version: "1.6",
        body: [
          { type: "TextBlock", text: "John Doe" },
        ],
      },
    });

    const body = result.template.body as Record<string, unknown>[];
    const text = body[0].text as string;
    expect(text).toMatch(/^\$\{.+\}$/);
  });

  it("templatizes FactSet values", () => {
    const result = handleTemplateCard({
      card: {
        type: "AdaptiveCard",
        version: "1.6",
        body: [
          {
            type: "FactSet",
            facts: [
              { title: "Name", value: "Alice" },
              { title: "Role", value: "Engineer" },
            ],
          },
        ],
      },
    });

    const body = result.template.body as Record<string, unknown>[];
    const factSet = body[0] as Record<string, unknown>;
    const facts = factSet.facts as Array<{ title: string; value: string }>;
    for (const fact of facts) {
      expect(fact.value).toMatch(/^\$\{.+\}$/);
    }
  });

  it("generates sampleData with matching keys", () => {
    const result = handleTemplateCard({
      card: {
        type: "AdaptiveCard",
        version: "1.6",
        body: [
          { type: "TextBlock", text: "Order #12345" },
          {
            type: "FactSet",
            facts: [
              { title: "Status", value: "Shipped" },
            ],
          },
        ],
      },
    });

    expect(result.sampleData).toBeDefined();
    expect(Object.keys(result.sampleData).length).toBeGreaterThan(0);

    // Every expression key should exist in sampleData
    for (const expr of result.expressions) {
      const key = expr.expression.replace(/^\$\{/, "").replace(/\}$/, "");
      // Keys from repeated items use relative references; top-level ones should be in sampleData
      if (!key.includes(".")) {
        expect(result.sampleData).toHaveProperty(key);
      }
    }
  });

  it("populates expressions array", () => {
    const result = handleTemplateCard({
      card: {
        type: "AdaptiveCard",
        version: "1.6",
        body: [
          { type: "TextBlock", text: "Hello World" },
          { type: "Image", url: "https://example.com/photo.png", altText: "A photo" },
        ],
      },
    });

    expect(result.expressions.length).toBeGreaterThan(0);
    for (const expr of result.expressions) {
      expect(expr.path).toBeDefined();
      expect(expr.expression).toMatch(/\$\{.+\}/);
      expect(expr.description).toBeDefined();
    }
  });

  it("generates a non-empty bindingGuide", () => {
    const result = handleTemplateCard({
      card: {
        type: "AdaptiveCard",
        version: "1.6",
        body: [
          { type: "TextBlock", text: "Some content here" },
        ],
      },
    });

    expect(result.bindingGuide).toBeDefined();
    expect(result.bindingGuide.length).toBeGreaterThan(0);
    expect(result.bindingGuide).toContain("Binding Guide");
  });
});
