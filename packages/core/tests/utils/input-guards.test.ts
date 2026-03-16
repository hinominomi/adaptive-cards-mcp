/**
 * Tests for input size guards
 */
import { describe, it, expect, beforeEach } from "vitest";
import { checkInputSize, checkCardComplexity, checkDataSize, setInputLimits } from "../../src/utils/input-guards.js";

describe("Input Guards", () => {
  beforeEach(() => {
    setInputLimits({
      maxInputSizeBytes: 1_048_576,
      maxElementCount: 200,
      maxNestingDepth: 10,
      maxDataRows: 1000,
      maxDataColumns: 50,
    });
  });

  describe("checkInputSize", () => {
    it("should pass for normal-sized input", () => {
      expect(() => checkInputSize({ text: "hello" }, "test")).not.toThrow();
    });

    it("should throw for oversized input", () => {
      setInputLimits({ maxInputSizeBytes: 10 });
      expect(() => checkInputSize({ text: "this is a long string" }, "test")).toThrow(
        /exceeds maximum size/,
      );
    });
  });

  describe("checkCardComplexity", () => {
    it("should pass for simple cards", () => {
      expect(() =>
        checkCardComplexity({
          type: "AdaptiveCard",
          body: [
            { type: "TextBlock", text: "Hello" },
            { type: "TextBlock", text: "World" },
          ],
        }),
      ).not.toThrow();
    });

    it("should throw for cards exceeding element limit", () => {
      setInputLimits({ maxElementCount: 2 });
      const body = Array.from({ length: 5 }, (_, i) => ({
        type: "TextBlock",
        text: `Item ${i}`,
      }));
      expect(() =>
        checkCardComplexity({ type: "AdaptiveCard", body }),
      ).toThrow(/element count exceeds/);
    });

    it("should throw for deeply nested cards", () => {
      setInputLimits({ maxNestingDepth: 2 });
      const card = {
        type: "AdaptiveCard",
        body: [
          {
            type: "Container",
            items: [
              {
                type: "Container",
                items: [
                  {
                    type: "Container",
                    items: [{ type: "TextBlock", text: "Deep" }],
                  },
                ],
              },
            ],
          },
        ],
      };
      expect(() => checkCardComplexity(card)).toThrow(/nesting depth exceeds/);
    });
  });

  describe("checkDataSize", () => {
    it("should pass for normal arrays", () => {
      expect(() => checkDataSize([{ a: 1 }, { a: 2 }])).not.toThrow();
    });

    it("should throw for arrays exceeding row limit", () => {
      setInputLimits({ maxDataRows: 3 });
      const data = Array.from({ length: 5 }, (_, i) => ({ id: i }));
      expect(() => checkDataSize(data)).toThrow(/exceeds maximum.*rows/);
    });

    it("should throw for arrays exceeding column limit", () => {
      setInputLimits({ maxDataColumns: 2 });
      const data = [{ a: 1, b: 2, c: 3, d: 4 }];
      expect(() => checkDataSize(data)).toThrow(/columns.*exceeding maximum/);
    });

    it("should throw for oversized CSV strings", () => {
      setInputLimits({ maxInputSizeBytes: 10 });
      expect(() => checkDataSize("a,b,c\n1,2,3\n4,5,6\n7,8,9")).toThrow(/exceeds maximum size/);
    });
  });

  describe("checkCardComplexity edge cases", () => {
    it("should throw for non-array body", () => {
      expect(() =>
        checkCardComplexity({ type: "AdaptiveCard", body: "not an array" }),
      ).toThrow(/body must be an array/);
    });

    it("should only count objects with type property as elements", () => {
      setInputLimits({ maxElementCount: 2 });
      // 3 objects but only 2 have "type", so should pass
      expect(() =>
        checkCardComplexity({
          type: "AdaptiveCard",
          body: [
            { type: "TextBlock", text: "Hello" },
            { notAType: true, value: 42 },
            { type: "Image", url: "test.png" },
          ],
        }),
      ).not.toThrow();
    });

    it("should handle null body gracefully", () => {
      expect(() =>
        checkCardComplexity({ type: "AdaptiveCard" }),
      ).not.toThrow();
    });
  });
});
