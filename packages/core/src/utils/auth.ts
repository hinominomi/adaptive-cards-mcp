/**
 * Auth Middleware — API key and bearer token authentication for HTTP transport
 *
 * Enable via:
 *   MCP_API_KEY=your-secret-key  (simple API key auth)
 *   MCP_AUTH_MODE=bearer          (bearer token validation)
 *
 * When no auth env vars are set, auth is disabled (stdio transport default).
 */

import { createLogger } from "./logger.js";

const logger = createLogger("auth");

export type AuthMode = "none" | "api-key" | "bearer";

interface AuthConfig {
  mode: AuthMode;
  apiKey?: string;
  bearerValidation?: (token: string) => Promise<boolean>;
}

let authConfig: AuthConfig = { mode: "none" };

/**
 * Initialize auth from environment variables
 */
export function initAuthFromEnv(): void {
  const apiKey = process.env.MCP_API_KEY;
  const authMode = process.env.MCP_AUTH_MODE as AuthMode | undefined;

  if (apiKey) {
    authConfig = { mode: "api-key", apiKey };
    logger.info("Auth enabled: API key mode");
    return;
  }

  if (authMode === "bearer") {
    authConfig = { mode: "bearer" };
    logger.info("Auth enabled: Bearer token mode (external validation required)");
    return;
  }

  authConfig = { mode: "none" };
}

/**
 * Configure auth programmatically
 */
export function configureAuth(config: AuthConfig): void {
  authConfig = config;
}

/**
 * Get current auth mode
 */
export function getAuthMode(): AuthMode {
  return authConfig.mode;
}

/**
 * Set a custom bearer token validator (e.g., Azure AD/Entra ID token validation)
 */
export function setBearerValidator(validator: (token: string) => Promise<boolean>): void {
  authConfig.bearerValidation = validator;
}

/**
 * Validate an incoming request's authorization header.
 * Returns true if authorized, false otherwise.
 */
export async function validateAuth(authHeader?: string): Promise<{ authorized: boolean; error?: string }> {
  if (authConfig.mode === "none") {
    return { authorized: true };
  }

  if (!authHeader) {
    return { authorized: false, error: "Missing Authorization header" };
  }

  if (authConfig.mode === "api-key") {
    // Accept: "Bearer <key>" or "ApiKey <key>" or just the raw key
    const key = authHeader.replace(/^(Bearer|ApiKey)\s+/i, "").trim();
    if (key === authConfig.apiKey) {
      return { authorized: true };
    }
    logger.warn("API key auth failed: invalid key");
    return { authorized: false, error: "Invalid API key" };
  }

  if (authConfig.mode === "bearer") {
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return { authorized: false, error: "Missing bearer token" };
    }

    if (authConfig.bearerValidation) {
      try {
        const valid = await authConfig.bearerValidation(token);
        if (valid) {
          return { authorized: true };
        }
        logger.warn("Bearer token validation failed");
        return { authorized: false, error: "Invalid bearer token" };
      } catch (err) {
        logger.error("Bearer validation error", { error: String(err) });
        return { authorized: false, error: "Token validation error" };
      }
    }

    // No validator configured — reject
    return { authorized: false, error: "Bearer token validation not configured" };
  }

  return { authorized: false, error: "Unknown auth mode" };
}

// Note: initAuthFromEnv() is NOT called on module load. The server
// initializes auth explicitly for the SSE transport path.
