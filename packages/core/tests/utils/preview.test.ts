/**
 * Tests for preview HTML generation
 */
import { describe, it, expect, afterEach } from "vitest";
import { existsSync, unlinkSync, readFileSync } from "node:fs";
import { generatePreviewHtml, writePreviewFile } from "../../src/utils/preview.js";

const sampleCard = {
  type: "AdaptiveCard",
  version: "1.6",
  body: [{ type: "TextBlock", text: "Hello World", wrap: true }],
};

describe("Preview", () => {
  const filesToCleanup: string[] = [];

  afterEach(() => {
    for (const f of filesToCleanup) {
      try { unlinkSync(f); } catch { /* ignore */ }
    }
    filesToCleanup.length = 0;
  });

  it("should generate valid HTML with embedded card payload", () => {
    const html = generatePreviewHtml(sampleCard);

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("adaptivecards.microsoft.com/designer");
    expect(html).toContain("ac-designer-ready");
    expect(html).toContain("cardPayload");
    expect(html).toContain("Hello World");
  });

  it("should escape card JSON safely to prevent XSS", () => {
    const cardWithXSS = {
      type: "AdaptiveCard",
      version: "1.6",
      body: [{ type: "TextBlock", text: '<script>alert("xss")</script>' }],
    };

    const html = generatePreviewHtml(cardWithXSS);
    // Raw <script> must NOT appear in the output
    expect(html).not.toContain("<script>alert");
    // Should be escaped to unicode
    expect(html).toContain("\\u003c");
    expect(html).toContain("\\u003e");
  });

  it("should escape ampersands in card content", () => {
    const card = {
      type: "AdaptiveCard",
      version: "1.6",
      body: [{ type: "TextBlock", text: "A & B < C > D" }],
    };

    const html = generatePreviewHtml(card);
    // The card payload section should not contain raw & < >
    const scriptStart = html.indexOf("var cardPayload = ");
    const scriptEnd = html.indexOf("var iframe = ");
    const payloadSection = html.slice(scriptStart, scriptEnd);
    expect(payloadSection).not.toContain("& B");
    expect(payloadSection).toContain("\\u0026");
  });

  it("should use correct postMessage targetOrigin (origin only, no path)", () => {
    const html = generatePreviewHtml(sampleCard);

    // targetOrigin must be origin-only, NOT origin + "/designer"
    expect(html).toContain('}, designerOrigin);');
    expect(html).not.toContain('designerOrigin + "/designer"');
  });

  it("should include postMessage with correct protocol structure", () => {
    const html = generatePreviewHtml(sampleCard);

    // Verify the postMessage structure matches AC Designer protocol
    expect(html).toContain('type: "cardPayload"');
    expect(html).toContain('id: "card"');
    expect(html).toContain("payload: cardPayload");
  });

  it("should write preview file and return a file:// URL", () => {
    const fileUrl = writePreviewFile(sampleCard);
    // Extract path from file:// URL for cleanup
    const filePath = fileUrl.replace(/^file:\/\//, "");
    filesToCleanup.push(filePath);

    expect(fileUrl).toMatch(/^file:\/\//);
    expect(fileUrl).toContain("ac-preview-");
    expect(fileUrl).toMatch(/\.html$/);
    expect(existsSync(filePath)).toBe(true);
  });

  it("should produce valid HTML file content", () => {
    const fileUrl = writePreviewFile(sampleCard);
    const filePath = fileUrl.replace(/^file:\/\//, "");
    filesToCleanup.push(filePath);

    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("<!DOCTYPE html>");
    expect(content).toContain("Hello World");
    expect(content).toContain("ac-designer-ready");
  });

  it("should handle cards with deeply nested special characters", () => {
    const card = {
      type: "AdaptiveCard",
      version: "1.6",
      body: [{
        type: "TextBlock",
        text: "Test </script><script>alert(1)</script> end",
      }],
    };

    const html = generatePreviewHtml(card);
    // Must not break out of the script context
    expect(html).not.toContain("</script><script>");
    expect(html).toContain("\\u003c/script\\u003e");
  });

  it("should handle empty card body", () => {
    const card = { type: "AdaptiveCard", version: "1.6", body: [] };
    const html = generatePreviewHtml(card);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("cardPayload");
  });
});
