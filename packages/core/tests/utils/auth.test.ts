/**
 * Tests for auth middleware
 */
import { describe, it, expect, beforeEach } from "vitest";
import { configureAuth, validateAuth, getAuthMode } from "../../src/utils/auth.js";

describe("Auth Middleware", () => {
  beforeEach(() => {
    configureAuth({ mode: "none" });
  });

  it("should allow all requests when auth is disabled", async () => {
    const result = await validateAuth();
    expect(result.authorized).toBe(true);
  });

  it("should validate API key auth", async () => {
    configureAuth({ mode: "api-key", apiKey: "test-secret-key" });
    expect(getAuthMode()).toBe("api-key");

    // Valid key
    const valid = await validateAuth("Bearer test-secret-key");
    expect(valid.authorized).toBe(true);

    // Invalid key
    const invalid = await validateAuth("Bearer wrong-key");
    expect(invalid.authorized).toBe(false);

    // Missing header
    const missing = await validateAuth();
    expect(missing.authorized).toBe(false);
  });

  it("should accept raw API key without Bearer prefix", async () => {
    configureAuth({ mode: "api-key", apiKey: "test-secret-key" });

    const result = await validateAuth("test-secret-key");
    expect(result.authorized).toBe(true);
  });

  it("should accept ApiKey prefix", async () => {
    configureAuth({ mode: "api-key", apiKey: "test-secret-key" });

    const result = await validateAuth("ApiKey test-secret-key");
    expect(result.authorized).toBe(true);
  });

  it("should require bearer validator in bearer mode", async () => {
    configureAuth({ mode: "bearer" });

    const result = await validateAuth("Bearer some-token");
    expect(result.authorized).toBe(false);
    expect(result.error).toContain("not configured");
  });

  it("should use custom bearer validator", async () => {
    configureAuth({
      mode: "bearer",
      bearerValidation: async (token) => token === "valid-token",
    });

    const valid = await validateAuth("Bearer valid-token");
    expect(valid.authorized).toBe(true);

    const invalid = await validateAuth("Bearer invalid-token");
    expect(invalid.authorized).toBe(false);
  });
});
