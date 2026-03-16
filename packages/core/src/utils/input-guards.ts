/**
 * Input Size Guards — Prevent DoS via oversized inputs
 */

export interface InputLimits {
  maxInputSizeBytes: number;
  maxElementCount: number;
  maxNestingDepth: number;
  maxDataRows: number;
  maxDataColumns: number;
}

const DEFAULT_LIMITS: InputLimits = {
  maxInputSizeBytes: 1_048_576, // 1 MB
  maxElementCount: 200,
  maxNestingDepth: 10,
  maxDataRows: 1000,
  maxDataColumns: 50,
};

let currentLimits = { ...DEFAULT_LIMITS };

/**
 * Override default input limits
 */
export function setInputLimits(overrides: Partial<InputLimits>): void {
  currentLimits = { ...currentLimits, ...overrides };
}

/**
 * Get current input limits
 */
export function getInputLimits(): InputLimits {
  return { ...currentLimits };
}

/**
 * Check input size (JSON serialized byte count)
 */
export function checkInputSize(input: unknown, label: string): void {
  const serialized = JSON.stringify(input);
  if (serialized.length > currentLimits.maxInputSizeBytes) {
    throw new Error(
      `Input "${label}" exceeds maximum size of ${currentLimits.maxInputSizeBytes} bytes (got ${serialized.length} bytes)`,
    );
  }
}

/**
 * Check card element count and nesting depth.
 * Only counts objects with a valid "type" property as elements.
 */
export function checkCardComplexity(card: Record<string, unknown>): void {
  // Validate that body is an array if present
  if (card.body !== undefined && !Array.isArray(card.body)) {
    throw new Error("Card body must be an array");
  }

  let elementCount = 0;
  let maxDepth = 0;

  function walk(elements: unknown[], depth: number): void {
    if (!Array.isArray(elements)) return;
    maxDepth = Math.max(maxDepth, depth);

    if (depth > currentLimits.maxNestingDepth) {
      throw new Error(
        `Card nesting depth exceeds maximum of ${currentLimits.maxNestingDepth}`,
      );
    }

    for (const el of elements) {
      if (!el || typeof el !== "object" || Array.isArray(el)) continue;
      const element = el as Record<string, unknown>;

      // Only count objects with a "type" property as card elements
      if (typeof element.type !== "string") continue;
      elementCount++;

      if (elementCount > currentLimits.maxElementCount) {
        throw new Error(
          `Card element count exceeds maximum of ${currentLimits.maxElementCount}`,
        );
      }

      if (Array.isArray(element.items)) walk(element.items, depth + 1);
      if (Array.isArray(element.columns)) {
        for (const col of element.columns) {
          const c = col as Record<string, unknown>;
          if (Array.isArray(c.items)) walk(c.items, depth + 1);
        }
      }
      if (Array.isArray(element.rows)) {
        for (const row of element.rows) {
          const r = row as Record<string, unknown>;
          if (Array.isArray(r.cells)) {
            for (const cell of r.cells) {
              const ce = cell as Record<string, unknown>;
              if (Array.isArray(ce.items)) walk(ce.items, depth + 1);
            }
          }
        }
      }
    }
  }

  if (Array.isArray(card.body)) {
    walk(card.body, 0);
  }
}

/**
 * Check data array size (row count and column count)
 */
export function checkDataSize(data: unknown): void {
  if (Array.isArray(data)) {
    if (data.length > currentLimits.maxDataRows) {
      throw new Error(
        `Data array exceeds maximum of ${currentLimits.maxDataRows} rows (got ${data.length})`,
      );
    }
    if (data.length > 0 && data[0] && typeof data[0] === "object") {
      const colCount = Object.keys(data[0] as Record<string, unknown>).length;
      if (colCount > currentLimits.maxDataColumns) {
        throw new Error(
          `Data has ${colCount} columns, exceeding maximum of ${currentLimits.maxDataColumns}`,
        );
      }
    }
  }

  if (typeof data === "string") {
    // CSV size check
    if (data.length > currentLimits.maxInputSizeBytes) {
      throw new Error(
        `CSV data exceeds maximum size of ${currentLimits.maxInputSizeBytes} bytes`,
      );
    }
    const lines = data.split("\n").filter((l) => l.trim().length > 0);
    // Subtract 1 for header row
    const dataRowCount = Math.max(0, lines.length - 1);
    if (dataRowCount > currentLimits.maxDataRows) {
      throw new Error(
        `CSV data exceeds maximum of ${currentLimits.maxDataRows} data rows (got ${dataRowCount}, excluding header)`,
      );
    }
  }
}
