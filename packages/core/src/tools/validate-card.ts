/**
 * validate_card tool handler
 */

import type { ValidateCardInput, ValidationResult, ValidationError } from "../types/index.js";
import { validateCard } from "../core/schema-validator.js";
import { analyzeCard, findDuplicateIds } from "../core/card-analyzer.js";
import { checkAccessibility } from "../core/accessibility-checker.js";
import { checkHostCompatibility } from "../core/host-compatibility.js";

/**
 * Validate an Adaptive Card and return comprehensive diagnostics with suggested fixes
 */
export function handleValidateCard(input: ValidateCardInput): ValidationResult {
  const { card, host = "generic", strictMode = false } = input;

  // Schema validation
  const schemaResult = validateCard(card);

  // Card analysis
  const stats = analyzeCard(card);

  // Accessibility check
  const accessibility = checkAccessibility(card);

  // Host compatibility
  const hostCompatibility = checkHostCompatibility(card, host);

  // Structural best-practice checks
  const errors: ValidationError[] = [...schemaResult.errors];

  // Enrich schema errors with suggested fixes
  for (const error of errors) {
    error.suggestedFix = getSuggestedFix(error);
  }

  // Check duplicate IDs
  const dupeIds = findDuplicateIds(card);
  for (const id of dupeIds) {
    errors.push({
      path: `(id="${id}")`,
      message: `Duplicate element ID: "${id}"`,
      severity: "error",
      rule: "duplicate-id",
      suggestedFix: {
        description: `Rename one of the elements with id="${id}" to a unique value`,
        patch: { id: `${id}_2` },
      },
    });
  }

  // Nesting depth warning
  if (stats.nestingDepth > 5) {
    errors.push({
      path: "$.body",
      message: `Nesting depth is ${stats.nestingDepth} (recommended max: 5)`,
      severity: "warning",
      rule: "nesting-depth",
      suggestedFix: {
        description: "Use the transform_card tool with transform: 'flatten' to reduce nesting",
      },
    });
  }

  // Element count warning
  if (stats.elementCount > 50) {
    errors.push({
      path: "$.body",
      message: `Card has ${stats.elementCount} elements (recommended max: 50)`,
      severity: "warning",
      rule: "element-count",
      suggestedFix: {
        description: "Use optimize_card with goals: ['performance', 'compact'] to reduce element count",
      },
    });
  }

  // Best practice: Action.Submit deprecation
  if (stats.actionTypes.includes("Action.Submit")) {
    errors.push({
      path: "(actions)",
      message: "Consider using Action.Execute instead of Action.Submit for Universal Actions support",
      severity: "info",
      rule: "prefer-execute",
      suggestedFix: {
        description: "Use optimize_card with goals: ['modern'] to automatically replace Action.Submit with Action.Execute",
      },
    });
  }

  // Host compatibility as errors/warnings with suggested fixes
  for (const unsupported of hostCompatibility.unsupportedElements) {
    errors.push({
      path: unsupported.path,
      message: unsupported.reason,
      severity: strictMode ? "error" : "warning",
      rule: "host-compatibility",
      suggestedFix: {
        description: `Use transform_card with transform: 'apply-host-config' and targetHost: '${host}' to auto-adapt`,
      },
    });
  }

  // Accessibility issue suggestions
  for (const issue of accessibility.issues) {
    const existingError = errors.find((e) => e.message === issue);
    if (!existingError) {
      errors.push({
        path: extractPathFromIssue(issue),
        message: issue,
        severity: "info",
        rule: "accessibility",
        suggestedFix: {
          description: "Use optimize_card with goals: ['accessibility'] to auto-fix accessibility issues",
        },
      });
    }
  }

  const hasErrors = errors.some((e) => e.severity === "error");
  const hasWarnings = errors.some((e) => e.severity === "warning");

  return {
    valid: strictMode ? !hasErrors && !hasWarnings : !hasErrors,
    errors,
    accessibility,
    hostCompatibility,
    stats,
  };
}

/**
 * Generate a suggested fix for a validation error
 */
function getSuggestedFix(error: ValidationError): ValidationError["suggestedFix"] {
  // Missing required property — use permissive regex to match property names with hyphens, dots, etc.
  if (error.rule === "schema/required" && error.message.includes("Missing required property")) {
    const propMatch = error.message.match(/"([^"]+)"/);
    const prop = propMatch?.[1];
    if (prop === "type") {
      return { description: 'Add "type": "AdaptiveCard" to the root object', patch: { type: "AdaptiveCard" } };
    }
    if (prop === "version") {
      return { description: 'Add "version": "1.6" to the card', patch: { version: "1.6" } };
    }
    if (prop === "text") {
      return { description: `Add a "text" property with the desired content`, patch: { text: "Sample text" } };
    }
    if (prop === "url") {
      return { description: `Add a "url" property`, patch: { url: "https://example.com/image.png" } };
    }
    return { description: `Add the missing "${prop}" property` };
  }

  // Unknown property — permissive regex for any quoted value
  if (error.rule === "schema/additionalProperties") {
    const propMatch = error.message.match(/"([^"]+)"/);
    const prop = propMatch?.[1] || "unknown";
    return { description: `Remove the unknown property "${prop}" or check for typos` };
  }

  // Type error
  if (error.rule === "schema/type") {
    return { description: `Check the data type at ${error.path} — ${error.message}` };
  }

  // Unknown element type
  if (error.rule === "unknown-element-type") {
    return { description: "Check spelling of the element type. Valid types: TextBlock, Image, Container, ColumnSet, FactSet, Table, etc." };
  }

  // TextBlock missing text
  if (error.rule === "best-practice/textblock-text") {
    return { description: 'Add a "text" property to the TextBlock', patch: { text: "" } };
  }

  // Image missing url
  if (error.rule === "best-practice/image-url") {
    return { description: 'Add a "url" property to the Image element', patch: { url: "" } };
  }

  return undefined;
}

/**
 * Extract path from accessibility issue string.
 * Accessibility issues use format: "$.body[0].items[1]: Issue description"
 * or "Card is missing 'speak' property..."
 */
function extractPathFromIssue(issue: string): string {
  // Match paths like $.body[0].text, $.actions[1].card.body
  const match = issue.match(/(\$\.[\w.[\]]+)/);
  if (match) return match[1];
  // Match "Card is missing..." style issues
  if (issue.toLowerCase().startsWith("card ")) return "$";
  return "(card)";
}
