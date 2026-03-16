/**
 * Rate Limiter — Token bucket per tool to prevent API quota burn
 *
 * Algorithm: Token bucket with integer-based tracking.
 * Each tool gets a bucket with maxTokens capacity. Tokens are consumed on each call
 * and refilled based on elapsed time. Using integer milliseconds internally to avoid
 * floating-point drift over long periods.
 *
 * Tuning guide:
 * - LLM tools (generate_card, data_to_card): 10 max, 1/sec refill — allows bursts
 *   but prevents sustained >1 req/sec which would burn API quota.
 * - Non-LLM tools: 20 max, 2/sec refill — generous for local computation.
 *
 * Enable via: MCP_RATE_LIMIT=true
 * Configure per tool via: setToolRateLimit("tool_name", { maxTokens: N, refillRatePerSec: M })
 */

export interface BucketConfig {
  maxTokens: number;
  refillRatePerSec: number;
}

interface Bucket {
  /** Tokens remaining, scaled by 1000 (millitokens) for integer precision */
  milliTokens: number;
  lastRefillMs: number;
}

const DEFAULT_CONFIG: BucketConfig = {
  maxTokens: 20,
  refillRatePerSec: 2,
};

const LLM_TOOL_CONFIG: BucketConfig = {
  maxTokens: 10,
  refillRatePerSec: 1,
};

const toolConfigs = new Map<string, BucketConfig>([
  ["generate_card", LLM_TOOL_CONFIG],
  ["data_to_card", LLM_TOOL_CONFIG],
  ["generate_and_validate", LLM_TOOL_CONFIG],
  ["card_workflow", LLM_TOOL_CONFIG],
]);

const buckets = new Map<string, Bucket>();

let rateLimitEnabled = false;

/**
 * Enable or disable rate limiting
 */
export function setRateLimitEnabled(enabled: boolean): void {
  rateLimitEnabled = enabled;
}

/**
 * Configure rate limit for a specific tool.
 * Call this to register new tools or override defaults.
 */
export function setToolRateLimit(tool: string, config: BucketConfig): void {
  toolConfigs.set(tool, config);
  // Reset bucket so new config takes effect immediately
  buckets.delete(tool);
}

/**
 * Register a tool with default rate limits if not already configured.
 * Called automatically when tools are defined.
 */
export function registerToolIfMissing(tool: string, isLLMTool: boolean): void {
  if (!toolConfigs.has(tool)) {
    toolConfigs.set(tool, isLLMTool ? LLM_TOOL_CONFIG : DEFAULT_CONFIG);
  }
}

/**
 * Check rate limit for a tool. Throws if rate limited.
 */
export function checkRateLimit(tool: string): void {
  if (!rateLimitEnabled) return;

  const config = toolConfigs.get(tool) || DEFAULT_CONFIG;
  const now = Date.now();
  const maxMilliTokens = config.maxTokens * 1000;

  let bucket = buckets.get(tool);
  if (!bucket) {
    bucket = { milliTokens: maxMilliTokens, lastRefillMs: now };
    buckets.set(tool, bucket);
  }

  // Refill tokens using integer millisecond arithmetic (no float drift)
  const elapsedMs = now - bucket.lastRefillMs;
  const refillMilliTokens = elapsedMs * config.refillRatePerSec; // ms * tokens/sec = millitokens
  bucket.milliTokens = Math.min(maxMilliTokens, bucket.milliTokens + refillMilliTokens);
  bucket.lastRefillMs = now;

  if (bucket.milliTokens < 1000) {
    throw new Error(
      `Rate limit exceeded for tool "${tool}". Max ${config.maxTokens} requests, refill ${config.refillRatePerSec}/sec. Try again shortly.`,
    );
  }

  bucket.milliTokens -= 1000;
}
