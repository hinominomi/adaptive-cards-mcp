/**
 * Tests for debug logger
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { log, createLogger, nextRequestId, initLogger } from "../../src/utils/logger.js";

describe("Logger", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    initLogger(); // Reset
  });

  it("should not log when DEBUG is not set", () => {
    const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    process.env.DEBUG = "";
    initLogger();

    log("info", "test message");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("should log when DEBUG=adaptive-cards-mcp", () => {
    const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    process.env.DEBUG = "adaptive-cards-mcp";
    initLogger();

    log("info", "test message");
    expect(spy).toHaveBeenCalledOnce();

    const output = JSON.parse((spy.mock.calls[0][0] as string).trim());
    expect(output.level).toBe("info");
    expect(output.msg).toBe("test message");
    spy.mockRestore();
  });

  it("should create scoped loggers", () => {
    const spy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    process.env.DEBUG = "adaptive-cards-mcp";
    initLogger();

    const logger = createLogger("test-scope");
    logger.info("scoped message");

    const output = JSON.parse((spy.mock.calls[0][0] as string).trim());
    expect(output.scope).toBe("test-scope");
    spy.mockRestore();
  });

  it("should generate unique request IDs", () => {
    const id1 = nextRequestId();
    const id2 = nextRequestId();
    expect(id1).toMatch(/^req-/);
    expect(id2).toMatch(/^req-/);
    expect(id1).not.toBe(id2);
  });
});
