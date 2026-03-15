import { describe, it, expect } from "vitest";
import { handleTransformCard } from "../../src/tools/transform-card.js";

describe("transform_card tool", () => {
  it("downgrades version from 1.6 to 1.3", () => {
    const result = handleTransformCard({
      card: {
        type: "AdaptiveCard",
        version: "1.6",
        body: [{ type: "TextBlock", text: "Hello", wrap: true }],
      },
      transform: "downgrade-version",
      targetVersion: "1.3",
    });

    expect(result.card.version).toBe("1.3");
    expect(result.changes.some((c) => c.includes("Downgraded version"))).toBe(true);
  });

  it("converts Table to ColumnSet on downgrade below 1.5", () => {
    const result = handleTransformCard({
      card: {
        type: "AdaptiveCard",
        version: "1.6",
        body: [
          {
            type: "Table",
            columns: [{ width: 1 }, { width: 1 }],
            rows: [
              {
                type: "TableRow",
                cells: [
                  { type: "TableCell", items: [{ type: "TextBlock", text: "Name", wrap: true }] },
                  { type: "TableCell", items: [{ type: "TextBlock", text: "Alice", wrap: true }] },
                ],
              },
            ],
          },
        ],
      },
      transform: "downgrade-version",
      targetVersion: "1.3",
    });

    const body = result.card.body as Record<string, unknown>[];
    // Table should have been converted — no Table elements should remain
    const hasTable = JSON.stringify(body).includes('"type":"Table"');
    expect(hasTable).toBe(false);
    expect(result.changes.some((c) => c.includes("Table") || c.includes("ColumnSet"))).toBe(true);
  });

  it("replaces Action.Execute with Action.Submit on downgrade below 1.4", () => {
    const result = handleTransformCard({
      card: {
        type: "AdaptiveCard",
        version: "1.6",
        body: [{ type: "TextBlock", text: "Test", wrap: true }],
        actions: [
          { type: "Action.Execute", title: "Submit", verb: "submit" },
        ],
      },
      transform: "downgrade-version",
      targetVersion: "1.3",
    });

    const actions = result.card.actions as Record<string, unknown>[];
    expect(actions[0].type).toBe("Action.Submit");
    expect(result.changes.some((c) => c.includes("Action.Execute") && c.includes("Action.Submit"))).toBe(true);
  });

  it("upgrades from 1.3 and adds Action.Execute", () => {
    const result = handleTransformCard({
      card: {
        type: "AdaptiveCard",
        version: "1.3",
        body: [{ type: "TextBlock", text: "Test", wrap: true }],
        actions: [
          { type: "Action.Submit", title: "Submit" },
        ],
      },
      transform: "upgrade-version",
      targetVersion: "1.6",
    });

    expect(result.card.version).toBe("1.6");
    const actions = result.card.actions as Record<string, unknown>[];
    expect(actions[0].type).toBe("Action.Execute");
    expect(result.changes.some((c) => c.includes("Upgraded version"))).toBe(true);
  });

  it("apply-host-config for outlook downgrades version", () => {
    const result = handleTransformCard({
      card: {
        type: "AdaptiveCard",
        version: "1.6",
        body: [{ type: "TextBlock", text: "Test", wrap: true }],
      },
      transform: "apply-host-config",
      targetHost: "outlook",
    });

    const version = parseFloat(result.card.version as string);
    expect(version).toBeLessThanOrEqual(1.4);
    expect(result.changes.length).toBeGreaterThan(0);
  });
});
