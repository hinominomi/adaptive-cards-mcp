/**
 * Tests for rate limiter
 */
import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit, setRateLimitEnabled, setToolRateLimit, registerToolIfMissing } from "../../src/utils/rate-limiter.js";

describe("Rate Limiter", () => {
  beforeEach(() => {
    setRateLimitEnabled(false);
  });

  it("should allow all requests when disabled", () => {
    for (let i = 0; i < 100; i++) {
      expect(() => checkRateLimit("test_tool")).not.toThrow();
    }
  });

  it("should enforce limits when enabled", () => {
    setRateLimitEnabled(true);
    setToolRateLimit("test_limited", { maxTokens: 2, refillRatePerSec: 0.001 });

    // First 2 should pass
    expect(() => checkRateLimit("test_limited")).not.toThrow();
    expect(() => checkRateLimit("test_limited")).not.toThrow();

    // Third should fail
    expect(() => checkRateLimit("test_limited")).toThrow(/Rate limit exceeded/);
  });

  it("should dynamically register tools", () => {
    setRateLimitEnabled(true);
    registerToolIfMissing("new_tool", false);

    // Should use default config (20 max tokens)
    for (let i = 0; i < 20; i++) {
      expect(() => checkRateLimit("new_tool")).not.toThrow();
    }
    expect(() => checkRateLimit("new_tool")).toThrow(/Rate limit exceeded/);
  });

  it("should use integer-based tracking for precision", () => {
    setRateLimitEnabled(true);
    setToolRateLimit("precision_test", { maxTokens: 1, refillRatePerSec: 1000 });

    // Use 1 token
    expect(() => checkRateLimit("precision_test")).not.toThrow();
    // Should be rate limited
    expect(() => checkRateLimit("precision_test")).toThrow(/Rate limit exceeded/);
  });
});
