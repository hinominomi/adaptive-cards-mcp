/**
 * Tests for telemetry
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { recordToolCall, getMetricsSnapshot, resetMetrics, initTelemetry } from "../../src/utils/telemetry.js";

describe("Telemetry", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    resetMetrics();
  });

  afterEach(() => {
    process.env = originalEnv;
    initTelemetry();
  });

  it("should not record when disabled", () => {
    process.env.MCP_TELEMETRY = "false";
    initTelemetry();

    recordToolCall("test_tool", 100);
    const snapshot = getMetricsSnapshot();
    expect(Object.keys(snapshot)).toHaveLength(0);
  });

  it("should record tool calls when enabled", () => {
    process.env.MCP_TELEMETRY = "true";
    initTelemetry();

    recordToolCall("generate_card", 500, false, 2000);
    recordToolCall("generate_card", 300, false, 1500);
    recordToolCall("validate_card", 50, false, 500);
    recordToolCall("generate_card", 200, true, 100);

    const snapshot = getMetricsSnapshot();
    expect(snapshot.generate_card.callCount).toBe(3);
    expect(snapshot.generate_card.errorCount).toBe(1);
    expect(snapshot.generate_card.avgDurationMs).toBe(333);
    expect(snapshot.generate_card.totalOutputBytes).toBe(3600);
    expect(snapshot.generate_card.avgOutputBytes).toBe(1200);
    expect(snapshot.validate_card.callCount).toBe(1);
  });

  it("should reset metrics", () => {
    process.env.MCP_TELEMETRY = "true";
    initTelemetry();

    recordToolCall("test_tool", 100);
    expect(Object.keys(getMetricsSnapshot())).toHaveLength(1);

    resetMetrics();
    expect(Object.keys(getMetricsSnapshot())).toHaveLength(0);
  });
});
