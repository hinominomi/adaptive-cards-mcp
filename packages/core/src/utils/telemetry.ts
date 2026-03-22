/**
 * Telemetry — Usage metrics collection with optional remote reporting
 *
 * Opt-in: MCP_TELEMETRY=true or ~/.adaptive-cards-mcp/config.json
 *
 * Local metrics are always available via getMetricsSnapshot().
 * Remote reporting to PostHog is handled by telemetry-remote.ts.
 */

import { queueEvent } from "./telemetry-remote.js";

interface ToolMetrics {
  callCount: number;
  errorCount: number;
  totalDurationMs: number;
  lastCallAt: number;
  totalOutputBytes: number;
}

interface SessionInfo {
  startedAt: number;
  version: string;
  transport: string;
  platform: string;
  nodeVersion: string;
  totalRequests: number;
  totalErrors: number;
  hostsUsed: Set<string>;
  intentsUsed: Set<string>;
}

const metrics = new Map<string, ToolMetrics>();
let telemetryEnabled = false;
const session: SessionInfo = {
  startedAt: Date.now(),
  version: "",
  transport: "",
  platform: process.platform,
  nodeVersion: process.version,
  totalRequests: 0,
  totalErrors: 0,
  hostsUsed: new Set(),
  intentsUsed: new Set(),
};

/**
 * Initialize telemetry from environment
 */
export async function initTelemetry(): Promise<void> {
  const { checkTelemetryConsent } = await import("./telemetry-consent.js");
  telemetryEnabled = checkTelemetryConsent();
}

/**
 * Check if telemetry is enabled
 */
export function isTelemetryEnabled(): boolean {
  return telemetryEnabled;
}

/**
 * Record session startup info
 */
export function recordSessionStart(version: string, transport: string): void {
  session.startedAt = Date.now();
  session.version = version;
  session.transport = transport;

  queueEvent("session_start", {
    version,
    transport,
    platform: session.platform,
    nodeVersion: session.nodeVersion,
  });
}

/**
 * Record host/intent usage for tracking popular configurations
 */
export function recordUsageContext(host?: string, intent?: string): void {
  if (!telemetryEnabled) return;
  if (host && host !== "generic") session.hostsUsed.add(host);
  if (intent) session.intentsUsed.add(intent);
}

/**
 * Record a tool invocation
 */
export function recordToolCall(
  tool: string,
  durationMs: number,
  error?: boolean,
  outputBytes?: number,
): void {
  if (!telemetryEnabled) return;

  session.totalRequests++;
  if (error) session.totalErrors++;

  let m = metrics.get(tool);
  if (!m) {
    m = { callCount: 0, errorCount: 0, totalDurationMs: 0, lastCallAt: 0, totalOutputBytes: 0 };
    metrics.set(tool, m);
  }

  m.callCount++;
  m.totalDurationMs += durationMs;
  m.lastCallAt = Date.now();
  if (error) m.errorCount++;
  if (outputBytes) m.totalOutputBytes += outputBytes;

  queueEvent("tool_call", { tool, durationMs, error: !!error, outputBytes: outputBytes ?? 0 });
}

/**
 * Get metrics snapshot for all tools
 */
export function getMetricsSnapshot(): Record<string, unknown> {
  const tools: Record<string, ToolMetrics & { avgDurationMs: number; avgOutputBytes: number }> = {};
  for (const [tool, m] of metrics) {
    tools[tool] = {
      ...m,
      avgDurationMs: m.callCount > 0 ? Math.round(m.totalDurationMs / m.callCount) : 0,
      avgOutputBytes: m.callCount > 0 ? Math.round(m.totalOutputBytes / m.callCount) : 0,
    };
  }
  return {
    session: {
      startedAt: new Date(session.startedAt).toISOString(),
      uptimeSeconds: Math.round((Date.now() - session.startedAt) / 1000),
      version: session.version,
      transport: session.transport,
      platform: session.platform,
      nodeVersion: session.nodeVersion,
      totalRequests: session.totalRequests,
      totalErrors: session.totalErrors,
      errorRate: session.totalRequests > 0
        ? (session.totalErrors / session.totalRequests * 100).toFixed(1) + "%"
        : "0%",
      hostsUsed: Array.from(session.hostsUsed),
      intentsUsed: Array.from(session.intentsUsed),
    },
    tools,
  };
}

/**
 * Record session end with summary metrics for remote reporting
 */
export function recordSessionEnd(): void {
  if (!telemetryEnabled) return;

  const snapshot = getMetricsSnapshot() as { session: Record<string, unknown>; tools: Record<string, unknown> };
  const toolBreakdown: Record<string, number> = {};
  for (const [tool, m] of metrics) {
    toolBreakdown[tool] = m.callCount;
  }

  queueEvent("session_end", {
    uptimeSeconds: snapshot.session.uptimeSeconds,
    totalRequests: session.totalRequests,
    totalErrors: session.totalErrors,
    toolBreakdown,
    hostsUsed: Array.from(session.hostsUsed),
    intentsUsed: Array.from(session.intentsUsed),
  });
}

/**
 * Reset all metrics
 */
export function resetMetrics(): void {
  metrics.clear();
}

// Note: initTelemetry() is NOT called on module load. The server calls it
// explicitly. Library users should call initTelemetry() themselves.
