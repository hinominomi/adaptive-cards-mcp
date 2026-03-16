/**
 * Telemetry — Opt-in metrics collection via OpenTelemetry-compatible interface
 *
 * Enable via: MCP_TELEMETRY=true
 *
 * This provides a lightweight metrics interface. For full OpenTelemetry support,
 * connect an OTel collector externally.
 */

interface ToolMetrics {
  callCount: number;
  errorCount: number;
  totalDurationMs: number;
  lastCallAt: number;
  totalOutputBytes: number;
}

const metrics = new Map<string, ToolMetrics>();
let telemetryEnabled = false;

/**
 * Initialize telemetry from environment
 */
export function initTelemetry(): void {
  telemetryEnabled = process.env.MCP_TELEMETRY === "true";
}

/**
 * Check if telemetry is enabled
 */
export function isTelemetryEnabled(): boolean {
  return telemetryEnabled;
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
}

/**
 * Get metrics snapshot for all tools
 */
export function getMetricsSnapshot(): Record<string, ToolMetrics & { avgDurationMs: number; avgOutputBytes: number }> {
  const snapshot: Record<string, ToolMetrics & { avgDurationMs: number; avgOutputBytes: number }> = {};
  for (const [tool, m] of metrics) {
    snapshot[tool] = {
      ...m,
      avgDurationMs: m.callCount > 0 ? Math.round(m.totalDurationMs / m.callCount) : 0,
      avgOutputBytes: m.callCount > 0 ? Math.round(m.totalOutputBytes / m.callCount) : 0,
    };
  }
  return snapshot;
}

/**
 * Reset all metrics
 */
export function resetMetrics(): void {
  metrics.clear();
}

// Note: initTelemetry() is NOT called on module load. The server calls it
// explicitly. Library users should call initTelemetry() themselves.
