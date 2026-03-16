/**
 * Adaptive Cards AI Builder — Type Definitions
 */

// ─── Card Schema Types ───────────────────────────────────────────────────────

export type HostApp =
  | "teams"
  | "outlook"
  | "webchat"
  | "windows"
  | "viva-connections"
  | "webex"
  | "generic";

export type Theme = "light" | "dark";

export type CardIntent =
  | "display"
  | "approval"
  | "form"
  | "notification"
  | "dashboard"
  | "report"
  | "status"
  | "profile"
  | "list"
  | "gallery";

export type DataPresentation =
  | "auto"
  | "table"
  | "facts"
  | "chart-bar"
  | "chart-line"
  | "chart-pie"
  | "chart-donut"
  | "list"
  | "carousel";

export type OptimizationGoal =
  | "accessibility"
  | "performance"
  | "compact"
  | "modern"
  | "readability";

export type TransformType =
  | "upgrade-version"
  | "downgrade-version"
  | "apply-host-config"
  | "flatten";

// ─── Tool Input Types ────────────────────────────────────────────────────────

export interface GenerateCardInput {
  content: string;
  data?: Record<string, unknown> | string;
  host?: HostApp;
  theme?: Theme;
  intent?: CardIntent;
  version?: string;
  maxElements?: number;
}

export interface DataToCardInput {
  data: Record<string, unknown> | unknown[] | string;
  presentation?: DataPresentation;
  title?: string;
  host?: HostApp;
  theme?: Theme;
  templateMode?: boolean;
}

export interface ValidateCardInput {
  card: Record<string, unknown>;
  host?: HostApp;
  strictMode?: boolean;
}

export interface OptimizeCardInput {
  card: Record<string, unknown>;
  goals?: OptimizationGoal[];
  host?: HostApp;
  theme?: Theme;
}

export interface TemplateCardInput {
  card?: Record<string, unknown>;
  dataShape?: Record<string, unknown>;
  description?: string;
}

export interface TransformCardInput {
  card: Record<string, unknown>;
  transform: TransformType;
  targetVersion?: string;
  targetHost?: HostApp;
  hostConfig?: Record<string, unknown>;
}

export interface SuggestLayoutInput {
  description: string;
  constraints?: {
    maxWidth?: number;
    interactive?: boolean;
    targetHost?: HostApp;
  };
}

// ─── Tool Output Types ───────────────────────────────────────────────────────

export interface ValidationError {
  path: string;
  message: string;
  severity: "error" | "warning" | "info";
  rule: string;
  suggestedFix?: {
    description: string;
    patch?: Record<string, unknown>;
  };
}

export interface AccessibilityReport {
  score: number; // 0-100
  issues: string[];
}

export interface HostCompatibilityReport {
  supported: boolean;
  unsupportedElements: Array<{
    path: string;
    type: string;
    reason: string;
  }>;
}

export interface CardStats {
  elementCount: number;
  nestingDepth: number;
  hasTemplating: boolean;
  version: string;
  elementTypes: string[];
  actionTypes: string[];
  inputCount: number;
  imageCount: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  accessibility: AccessibilityReport;
  hostCompatibility: HostCompatibilityReport;
  stats: CardStats;
}

export interface GenerateCardOutput {
  card: Record<string, unknown>;
  cardId?: string;
  template?: Record<string, unknown>;
  sampleData?: Record<string, unknown>;
  validation: ValidationResult;
  designNotes: string;
  references?: {
    examples: Array<{ name: string; description: string; card: Record<string, unknown> }>;
    hostConstraints?: {
      maxVersion: string;
      unsupportedElements: string[];
      maxActions: number;
      notes: string[];
    };
  };
}

export interface OptimizeCardOutput {
  card: Record<string, unknown>;
  changes: Array<{
    description: string;
    before: string;
    after: string;
  }>;
  improvement: {
    accessibilityBefore: number;
    accessibilityAfter: number;
    elementCountBefore: number;
    elementCountAfter: number;
    nestingDepthBefore: number;
    nestingDepthAfter: number;
  };
}

export interface TemplateCardOutput {
  template: Record<string, unknown>;
  sampleData: Record<string, unknown>;
  expressions: Array<{
    path: string;
    expression: string;
    description: string;
  }>;
  bindingGuide: string;
}

export interface TransformCardOutput {
  card: Record<string, unknown>;
  changes: string[];
  warnings: string[];
}

export interface LayoutSuggestion {
  pattern: string;
  elements: string[];
  layout: string;
  rationale: string;
  similarExample?: string;
}

export interface SuggestLayoutOutput {
  suggestion: LayoutSuggestion;
  alternatives: Array<{
    pattern: string;
    tradeoff: string;
  }>;
}

// ─── Layout Pattern Types ────────────────────────────────────────────────────

export interface LayoutPattern {
  name: string;
  description: string;
  intent: CardIntent[];
  elements: string[];
  dataShape: string; // "key-value" | "array" | "single-object" | "nested" | "any"
  template: Record<string, unknown>; // The card template to fill
  example?: string; // Reference to example file
}

// ─── LLM Client Types ────────────────────────────────────────────────────────

// ─── Compound Workflow Types ─────────────────────────────────────────────────

export interface CardWorkflowInput {
  steps: Array<{
    tool: "generate" | "validate" | "optimize" | "template" | "transform";
    params?: Record<string, unknown>;
  }>;
  content?: string;
  data?: Record<string, unknown> | string;
  host?: HostApp;
  version?: string;
}

export interface CardWorkflowOutput {
  card: Record<string, unknown>;
  cardId?: string;
  validation?: ValidationResult;
  stepsCompleted: string[];
  designNotes: string;
}

export interface GenerateAndValidateInput {
  content: string;
  data?: Record<string, unknown> | string;
  host?: HostApp;
  intent?: CardIntent;
  version?: string;
  optimizeGoals?: OptimizationGoal[];
}

// ─── LLM Client Types ────────────────────────────────────────────────────────

export interface LLMConfig {
  provider: "anthropic" | "openai" | "azure-openai" | "ollama";
  apiKey: string;
  model?: string;
  baseUrl?: string;
  apiVersion?: string;
}

export interface LLMGenerateRequest {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
}

export interface LLMGenerateResponse {
  content: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

// ─── Host Config Types ───────────────────────────────────────────────────────

export interface HostVersionSupport {
  host: HostApp;
  maxVersion: string;
  unsupportedElements: string[];
  unsupportedActions: string[];
  maxActions: number;
  notes: string[];
}
