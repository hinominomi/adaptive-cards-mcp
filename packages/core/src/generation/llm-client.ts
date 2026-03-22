/**
 * LLM Client — Multi-provider LLM integration for card generation
 *
 * Supported providers:
 *   - Anthropic (ANTHROPIC_API_KEY)
 *   - OpenAI (OPENAI_API_KEY)
 *   - Azure OpenAI (AZURE_OPENAI_API_KEY + AZURE_OPENAI_ENDPOINT)
 *   - Ollama (OLLAMA_BASE_URL, default: http://localhost:11434)
 */

import type { LLMConfig, LLMGenerateRequest, LLMGenerateResponse } from "../types/index.js";
import { createLogger } from "../utils/logger.js";
import { queueEvent } from "../utils/telemetry-remote.js";

const logger = createLogger("llm");

function classifyApiError(status: number): string {
  if (status === 401 || status === 403) return "authentication";
  if (status === 429) return "rate_limit";
  if (status >= 500) return "server_error";
  return "client_error";
}

const DEFAULT_TIMEOUT_MS = 60_000; // 60 seconds

let currentConfig: LLMConfig | null = null;

/**
 * Configure the LLM client with API credentials
 */
export function configureLLM(config: LLMConfig): void {
  currentConfig = config;
  logger.info("LLM configured", { provider: config.provider, model: config.model });
}

/**
 * Check if LLM is configured and available
 */
export function isLLMAvailable(): boolean {
  return currentConfig !== null && currentConfig.apiKey.length > 0;
}

/**
 * Get current LLM configuration
 */
export function getLLMConfig(): LLMConfig | null {
  return currentConfig;
}

/**
 * Initialize LLM from environment variables
 */
export function initLLMFromEnv(): void {
  // Try Anthropic first
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    configureLLM({
      provider: "anthropic",
      apiKey: anthropicKey,
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
    });
    return;
  }

  // Try Azure OpenAI
  const azureKey = process.env.AZURE_OPENAI_API_KEY;
  const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
  if (azureKey && azureEndpoint) {
    configureLLM({
      provider: "azure-openai",
      apiKey: azureKey,
      baseUrl: azureEndpoint,
      model: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4o",
      apiVersion: process.env.AZURE_OPENAI_API_VERSION || "2024-10-21",
    });
    return;
  }

  // Try OpenAI
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    configureLLM({
      provider: "openai",
      apiKey: openaiKey,
      model: process.env.OPENAI_MODEL || "gpt-4o",
    });
    return;
  }

  // Try Ollama (local, no API key required)
  const ollamaUrl = process.env.OLLAMA_BASE_URL;
  if (ollamaUrl) {
    configureLLM({
      provider: "ollama",
      apiKey: "ollama", // Ollama doesn't need a real key
      baseUrl: ollamaUrl,
      model: process.env.OLLAMA_MODEL || "llama3.1",
    });
    return;
  }
}

/**
 * Generate text using the configured LLM
 */
export async function generateWithLLM(
  request: LLMGenerateRequest,
): Promise<LLMGenerateResponse> {
  if (!currentConfig) {
    throw new Error("LLM not configured. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, AZURE_OPENAI_API_KEY, or OLLAMA_BASE_URL.");
  }

  logger.debug("LLM request", { provider: currentConfig.provider, model: currentConfig.model });

  switch (currentConfig.provider) {
    case "anthropic":
      return callAnthropic(request);
    case "openai":
      return callOpenAI(request);
    case "azure-openai":
      return callAzureOpenAI(request);
    case "ollama":
      return callOllama(request);
    default:
      throw new Error(`Unknown LLM provider: ${currentConfig.provider}`);
  }
}

async function callAnthropic(
  request: LLMGenerateRequest,
): Promise<LLMGenerateResponse> {
  const config = currentConfig!;
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.model || "claude-sonnet-4-20250514",
      max_tokens: request.maxTokens || 4096,
      system: request.systemPrompt,
      messages: [{ role: "user", content: request.userPrompt }],
    }),
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });

  if (!response.ok) {
    const errorText = await response.text();
    queueEvent("llm_api_error", { provider: "anthropic", status_code: response.status, error_type: classifyApiError(response.status) });
    throw new Error(`Anthropic API error (${response.status}): ${sanitizeApiError(errorText)}`);
  }

  const data = await response.json() as Record<string, unknown>;

  // Validate response structure
  if (!data.content || !Array.isArray(data.content)) {
    throw new Error("Anthropic API returned unexpected response format (missing content array)");
  }

  const contentArr = data.content as Array<{ type: string; text: string }>;
  const textContent = contentArr
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("");

  const usage = data.usage as { input_tokens?: number; output_tokens?: number } | undefined;

  return {
    content: textContent,
    usage: {
      inputTokens: usage?.input_tokens || 0,
      outputTokens: usage?.output_tokens || 0,
    },
  };
}

async function callOpenAI(
  request: LLMGenerateRequest,
): Promise<LLMGenerateResponse> {
  const config = currentConfig!;
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model || "gpt-4o",
      max_tokens: request.maxTokens || 4096,
      messages: [
        { role: "system", content: request.systemPrompt },
        { role: "user", content: request.userPrompt },
      ],
    }),
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });

  if (!response.ok) {
    const errorText = await response.text();
    queueEvent("llm_api_error", { provider: "openai", status_code: response.status, error_type: classifyApiError(response.status) });
    throw new Error(`OpenAI API error (${response.status}): ${sanitizeApiError(errorText)}`);
  }

  const data = await response.json() as Record<string, unknown>;

  // Validate response structure
  const choices = data.choices as Array<{ message?: { content?: string } }> | undefined;
  if (!choices || !Array.isArray(choices) || choices.length === 0) {
    throw new Error("OpenAI API returned unexpected response format (missing choices)");
  }

  const usage = data.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined;

  return {
    content: choices[0]?.message?.content || "",
    usage: {
      inputTokens: usage?.prompt_tokens || 0,
      outputTokens: usage?.completion_tokens || 0,
    },
  };
}

async function callAzureOpenAI(
  request: LLMGenerateRequest,
): Promise<LLMGenerateResponse> {
  const config = currentConfig!;
  const baseUrl = config.baseUrl!.replace(/\/$/, "");
  const deployment = config.model || "gpt-4o";
  const apiVersion = config.apiVersion || "2024-10-21";
  const url = `${baseUrl}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": config.apiKey,
    },
    body: JSON.stringify({
      max_tokens: request.maxTokens || 4096,
      messages: [
        { role: "system", content: request.systemPrompt },
        { role: "user", content: request.userPrompt },
      ],
    }),
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });

  if (!response.ok) {
    const errorText = await response.text();
    queueEvent("llm_api_error", { provider: "azure-openai", status_code: response.status, error_type: classifyApiError(response.status) });
    throw new Error(`Azure OpenAI API error (${response.status}): ${sanitizeApiError(errorText)}`);
  }

  const data = await response.json() as Record<string, unknown>;
  const choices = data.choices as Array<{ message?: { content?: string } }> | undefined;
  if (!choices || !Array.isArray(choices) || choices.length === 0) {
    throw new Error("Azure OpenAI API returned unexpected response format");
  }

  const usage = data.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined;

  return {
    content: choices[0]?.message?.content || "",
    usage: {
      inputTokens: usage?.prompt_tokens || 0,
      outputTokens: usage?.completion_tokens || 0,
    },
  };
}

async function callOllama(
  request: LLMGenerateRequest,
): Promise<LLMGenerateResponse> {
  const config = currentConfig!;
  const baseUrl = (config.baseUrl || "http://localhost:11434").replace(/\/$/, "");
  const url = `${baseUrl}/api/chat`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.model || "llama3.1",
      stream: false,
      messages: [
        { role: "system", content: request.systemPrompt },
        { role: "user", content: request.userPrompt },
      ],
    }),
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS * 2), // Ollama may be slower (local inference)
  });

  if (!response.ok) {
    const errorText = await response.text();
    queueEvent("llm_api_error", { provider: "ollama", status_code: response.status, error_type: classifyApiError(response.status) });
    throw new Error(`Ollama API error (${response.status}): ${sanitizeApiError(errorText)}`);
  }

  const data = await response.json() as Record<string, unknown>;
  const message = data.message as { content?: string } | undefined;

  return {
    content: message?.content || "",
    usage: {
      inputTokens: (data.prompt_eval_count as number) || 0,
      outputTokens: (data.eval_count as number) || 0,
    },
  };
}

/**
 * Sanitize API error messages to avoid leaking sensitive information
 */
function sanitizeApiError(errorText: string): string {
  // Truncate long error messages
  const truncated = errorText.length > 500 ? errorText.slice(0, 500) + "..." : errorText;
  // Redact anything that looks like a key/token
  return truncated.replace(/(?:sk-|key-|Bearer\s+)\S+/gi, "[REDACTED]");
}
