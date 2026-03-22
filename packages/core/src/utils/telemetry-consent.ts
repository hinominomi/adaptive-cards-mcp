/**
 * Telemetry consent — First-run notice and persistent config for CLI users.
 *
 * Prints a stderr notice on every startup until the user opts in.
 * On first run, creates a config file at ~/.adaptive-cards-mcp/config.json
 * with telemetry defaulting to false. Users opt in by setting
 * "telemetry": true in the config or via MCP_TELEMETRY=true env var.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CONFIG_DIR = join(homedir(), ".adaptive-cards-mcp");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

interface UserConfig {
  telemetry?: boolean;
}

/**
 * Read the user config file. Returns empty object if not found.
 */
function readConfig(): UserConfig {
  try {
    if (existsSync(CONFIG_FILE)) {
      return JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));
    }
  } catch {
    // Corrupted config — treat as first run
  }
  return {};
}

/**
 * Write the user config file.
 */
function writeConfig(config: UserConfig): void {
  try {
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true });
    }
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n");
  } catch {
    // Silently fail — don't break the server over config persistence
  }
}

/**
 * Check telemetry consent. Returns true if user has opted in.
 *
 * Priority: MCP_TELEMETRY env var > config file > default (false)
 *
 * On first run (no config file), creates config with telemetry: false.
 * Prints a notice to stderr on every startup until user opts in.
 */
export function checkTelemetryConsent(): boolean {
  // Env var takes highest priority
  const envValue = process.env.MCP_TELEMETRY;
  if (envValue === "true") return true;
  if (envValue === "false") return false;

  const config = readConfig();

  // If user has explicitly opted in, no notice needed
  if (config.telemetry === true) return true;

  // Show notice on every startup until user enables telemetry
  if (config.telemetry === undefined) {
    writeConfig({ telemetry: false });
  }
  console.error(
    "\n" +
    "┌─────────────────────────────────────────────────────────────┐\n" +
    "│  Telemetry: anonymous usage data helps improve this project │\n" +
    "│                                                             │\n" +
    "│  Opt in:  set MCP_TELEMETRY=true                           │\n" +
    "│  Or edit: ~/.adaptive-cards-mcp/config.json                 │\n" +
    "│                                                             │\n" +
    "│  What's sent: tool names, durations, error rates, platform  │\n" +
    "│  Never sent:  card content, prompts, personal data          │\n" +
    "│                                                             │\n" +
    "│  Details: https://github.com/VikrantSingh01/adaptive-cards- │\n" +
    "│           mcp#telemetry--privacy                            │\n" +
    "└─────────────────────────────────────────────────────────────┘\n"
  );
  return false;
}
