/**
 * Debug Logger — Structured logging with levels and request tracing
 *
 * Enable via: DEBUG=adaptive-cards-mcp
 * Levels: error, warn, info, debug
 */

export type LogLevel = "error" | "warn" | "info" | "debug";

const LOG_LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

let enabled = false;
let minLevel: LogLevel = "info";
let requestCounter = 0;

/**
 * Initialize logger from environment
 */
export function initLogger(): void {
  const debug = process.env.DEBUG || "";
  enabled =
    debug === "adaptive-cards-mcp" ||
    debug === "*" ||
    debug.includes("adaptive-cards");

  const levelEnv = process.env.LOG_LEVEL as LogLevel | undefined;
  if (levelEnv && levelEnv in LOG_LEVELS) {
    minLevel = levelEnv;
  } else if (enabled) {
    minLevel = "debug";
  }
}

/**
 * Generate a unique request ID for tracing
 */
export function nextRequestId(): string {
  return `req-${++requestCounter}-${Date.now().toString(36)}`;
}

/**
 * Log a message at the specified level (outputs to stderr to avoid polluting stdio transport)
 */
export function log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  if (!enabled) return;
  if (LOG_LEVELS[level] > LOG_LEVELS[minLevel]) return;

  const timestamp = new Date().toISOString();
  const entry: Record<string, unknown> = {
    ts: timestamp,
    level,
    msg: message,
  };
  if (context) {
    Object.assign(entry, context);
  }

  // Always write to stderr to avoid interfering with MCP stdio transport
  try {
    process.stderr.write(JSON.stringify(entry) + "\n");
  } catch {
    // Fallback for non-serializable context (circular refs, functions, etc.)
    process.stderr.write(JSON.stringify({ ts: entry.ts, level, msg: message }) + "\n");
  }
}

/**
 * Create a scoped logger for a specific tool/module
 */
export function createLogger(scope: string) {
  return {
    error: (msg: string, ctx?: Record<string, unknown>) =>
      log("error", msg, { scope, ...ctx }),
    warn: (msg: string, ctx?: Record<string, unknown>) =>
      log("warn", msg, { scope, ...ctx }),
    info: (msg: string, ctx?: Record<string, unknown>) =>
      log("info", msg, { scope, ...ctx }),
    debug: (msg: string, ctx?: Record<string, unknown>) =>
      log("debug", msg, { scope, ...ctx }),
  };
}

// Note: initLogger() is NOT called on module load. The server calls it
// explicitly after environment variables are fully set. Library users
// should call initLogger() themselves if they want debug logging.
