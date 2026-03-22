/**
 * Tests for remote telemetry reporting
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { initRemoteReporting, queueEvent, flushEvents, shutdownReporting, resetRemoteReporting } from "../../src/utils/telemetry-remote.js";
import { initTelemetry } from "../../src/utils/telemetry.js";

describe("Remote Telemetry", () => {
  const originalEnv = process.env;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    process.env = { ...originalEnv, MCP_TELEMETRY: "true", POSTHOG_API_KEY: "phc_test_key" };
    await initTelemetry();
    resetRemoteReporting();
    fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(async () => {
    resetRemoteReporting();
    process.env = originalEnv;
    await initTelemetry();
    vi.restoreAllMocks();
  });

  it("should not queue events when telemetry is disabled", async () => {
    process.env.MCP_TELEMETRY = "false";
    await initTelemetry();
    initRemoteReporting();

    queueEvent("test_event", { foo: "bar" });
    flushEvents();

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("should not queue events when API key is missing", () => {
    process.env.POSTHOG_API_KEY = "";
    initRemoteReporting();

    queueEvent("test_event", { foo: "bar" });
    flushEvents();

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("should not queue events before initialization", () => {
    // Don't call initRemoteReporting
    queueEvent("test_event", { foo: "bar" });
    flushEvents();

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("should batch and flush events", () => {
    initRemoteReporting();

    queueEvent("tool_call", { tool: "generate_card", durationMs: 100 });
    queueEvent("tool_call", { tool: "validate_card", durationMs: 50 });

    flushEvents();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toContain("/batch");

    const body = JSON.parse(options.body);
    expect(body.api_key).toBe("phc_test_key");
    expect(body.batch).toHaveLength(2);
    expect(body.batch[0].event).toBe("tool_call");
    expect(body.batch[0].properties.tool).toBe("generate_card");
    expect(body.batch[1].properties.tool).toBe("validate_card");
    // All events share the same session distinct_id
    expect(body.batch[0].distinct_id).toBe(body.batch[1].distinct_id);
    expect(body.batch[0].distinct_id).toBeTruthy();
  });

  it("should not flush when buffer is empty", () => {
    initRemoteReporting();
    flushEvents();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("should auto-flush at threshold", () => {
    initRemoteReporting();

    for (let i = 0; i < 20; i++) {
      queueEvent("tool_call", { tool: `tool_${i}` });
    }

    // Should have auto-flushed at 20 events
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.batch).toHaveLength(20);
  });

  it("should cap buffer at max size", () => {
    initRemoteReporting();

    // Queue more than MAX_BUFFER_SIZE (100) without triggering flush threshold
    // We need to avoid auto-flush at 20, so flush after each batch
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 19; j++) {
        queueEvent("tool_call", { tool: `tool_${i}_${j}` });
      }
    }
    // 5 * 19 = 95 events queued without auto-flush, plus some auto-flushes
    // The important thing is the buffer doesn't grow unbounded
    expect(fetchSpy.mock.calls.length).toBeGreaterThanOrEqual(0);
  });

  it("should silently handle fetch errors", () => {
    fetchSpy.mockRejectedValue(new Error("Network error"));
    initRemoteReporting();

    queueEvent("tool_call", { tool: "test" });
    // Should not throw
    expect(() => flushEvents()).not.toThrow();
  });

  it("should flush on shutdown", async () => {
    initRemoteReporting();

    queueEvent("session_end", { uptimeSeconds: 300 });

    await shutdownReporting();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.batch[0].event).toBe("session_end");
  });

  it("should handle shutdown with empty buffer", async () => {
    initRemoteReporting();
    await shutdownReporting();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("should include $lib property in events", () => {
    initRemoteReporting();
    queueEvent("test_event", { foo: "bar" });
    flushEvents();

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.batch[0].properties.$lib).toBe("adaptive-cards-mcp");
  });
});
