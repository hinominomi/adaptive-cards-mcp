/**
 * Remote Telemetry — Anonymous usage reporting via PostHog
 *
 * Sends non-PII usage data to help improve the project.
 * Opt-in: set MCP_TELEMETRY=true or ~/.adaptive-cards-mcp/config.json
 *
 * What is sent: tool names, call counts, durations, error rates,
 *   platform (OS), Node version, package version, transport type
 * What is never sent: card content, user prompts, data payloads,
 *   IP addresses, file paths, environment variables
 */

import { isTelemetryEnabled } from "./telemetry.js";

const FLUSH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const FLUSH_THRESHOLD = 20;
const MAX_BUFFER_SIZE = 100;
const SEND_TIMEOUT_MS = 5000;

interface PostHogEvent {
  event: string;
  properties: Record<string, unknown>;
  timestamp: string;
}

let sessionId = "";
let buffer: PostHogEvent[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;
let initialized = false;
let apiKey = "";
let apiHost = "";

function generateSessionId(): string {
  return crypto.randomUUID();
}

/**
 * Initialize remote reporting. Call once at server startup.
 * No-op if telemetry is disabled or API key is not configured.
 */
export function initRemoteReporting(): void {
  const envKey = process.env.POSTHOG_API_KEY;
  apiKey = envKey !== undefined ? envKey : "phc_DcD6DvZqJdGX5Rp2mfXpRkGo1ceqStSRQzukLcxYn1a";
  apiHost = process.env.POSTHOG_HOST || "https://eu.i.posthog.com";

  if (!isTelemetryEnabled() || !apiKey) return;

  sessionId = generateSessionId();
  buffer = [];
  initialized = true;

  flushTimer = setInterval(() => {
    flushEvents();
  }, FLUSH_INTERVAL_MS);

  // Don't keep the process alive just for telemetry
  if (flushTimer.unref) flushTimer.unref();
}

/**
 * Queue an event for remote reporting.
 * Silently drops events if not initialized or telemetry disabled.
 */
export function queueEvent(eventName: string, properties: Record<string, unknown>): void {
  if (!initialized || !isTelemetryEnabled() || !apiKey) return;

  const event: PostHogEvent = {
    event: eventName,
    properties: {
      ...properties,
      $lib: "adaptive-cards-mcp",
    },
    timestamp: new Date().toISOString(),
  };

  buffer.push(event);

  // Drop oldest events if buffer is full
  if (buffer.length > MAX_BUFFER_SIZE) {
    buffer = buffer.slice(buffer.length - MAX_BUFFER_SIZE);
  }

  // Auto-flush when threshold reached
  if (buffer.length >= FLUSH_THRESHOLD) {
    flushEvents();
  }
}

/**
 * Flush buffered events to PostHog. Fire-and-forget.
 */
export function flushEvents(): void {
  if (buffer.length === 0 || !apiKey) return;

  const batch = buffer.splice(0);

  const payload = {
    api_key: apiKey,
    batch: batch.map((e) => ({
      ...e,
      distinct_id: sessionId,
    })),
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);

  fetch(`${apiHost}/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: controller.signal,
  })
    .catch(() => {
      // Silently drop — telemetry must never break the server
    })
    .finally(() => {
      clearTimeout(timeout);
    });
}

/**
 * Flush remaining events and stop the timer. Call on shutdown.
 */
export async function shutdownReporting(): Promise<void> {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }

  if (buffer.length === 0 || !apiKey) {
    initialized = false;
    return;
  }

  // Final flush with await so events are sent before process exits
  const batch = buffer.splice(0);
  const payload = {
    api_key: apiKey,
    batch: batch.map((e) => ({
      ...e,
      distinct_id: sessionId,
    })),
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);

  try {
    await fetch(`${apiHost}/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch {
    // Silently drop
  } finally {
    clearTimeout(timeout);
  }

  initialized = false;
}

/**
 * Reset remote reporting state (for testing)
 */
export function resetRemoteReporting(): void {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  buffer = [];
  sessionId = "";
  apiKey = "";
  apiHost = "";
  initialized = false;
}
