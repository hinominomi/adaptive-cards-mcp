/**
 * Tests for telemetry
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { recordToolCall, getMetricsSnapshot, resetMetrics, initTelemetry } from "../../src/utils/telemetry.js";

describe("Telemetry", () => {
  const originalEnv = process.env;

  beforeEach(async () => {
    process.env = { ...originalEnv };
    resetMetrics();
  });

  afterEach(async () => {
    process.env = originalEnv;
    await initTelemetry();
  });

  it("should not record when disabled", async () => {
    process.env.MCP_TELEMETRY = "false";
    await initTelemetry();

    recordToolCall("test_tool", 100);
    const snapshot = getMetricsSnapshot() as { tools: Record<string, unknown> };
    expect(Object.keys(snapshot.tools)).toHaveLength(0);
  });

  it("should record tool calls when enabled", async () => {
    process.env.MCP_TELEMETRY = "true";
    await initTelemetry();

    recordToolCall("generate_card", 500, false, 2000);
    recordToolCall("generate_card", 300, false, 1500);
    recordToolCall("validate_card", 50, false, 500);
    recordToolCall("generate_card", 200, true, 100);

    const snapshot = getMetricsSnapshot() as { tools: Record<string, { callCount: number; errorCount: number; avgDurationMs: number; totalOutputBytes: number; avgOutputBytes: number }> };
    expect(snapshot.tools.generate_card.callCount).toBe(3);
    expect(snapshot.tools.generate_card.errorCount).toBe(1);
    expect(snapshot.tools.generate_card.avgDurationMs).toBe(333);
    expect(snapshot.tools.generate_card.totalOutputBytes).toBe(3600);
    expect(snapshot.tools.generate_card.avgOutputBytes).toBe(1200);
    expect(snapshot.tools.validate_card.callCount).toBe(1);
  });

  it("should reset metrics", async () => {
    process.env.MCP_TELEMETRY = "true";
    await initTelemetry();

    recordToolCall("test_tool", 100);
    const snapshot1 = getMetricsSnapshot() as { tools: Record<string, unknown> };
    expect(Object.keys(snapshot1.tools)).toHaveLength(1);

    resetMetrics();
    const snapshot2 = getMetricsSnapshot() as { tools: Record<string, unknown> };
    expect(Object.keys(snapshot2.tools)).toHaveLength(0);
  });
});
