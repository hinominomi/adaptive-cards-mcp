/**
 * Card Store — Session-scoped in-memory card persistence
 *
 * Allows tools to reference cards by ID instead of re-sending full JSON.
 * Cards auto-expire after a configurable TTL.
 */

import { randomUUID } from "node:crypto";

interface StoredCard {
  card: Record<string, unknown>;
  createdAt: number;
  metadata?: Record<string, unknown>;
}

const store = new Map<string, StoredCard>();
const MAX_CARDS = 100;
const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Background cleanup timer (unref'd so it doesn't keep the process alive)
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function startCleanupTimer(): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(cleanup, CLEANUP_INTERVAL_MS);
  cleanupTimer.unref(); // Don't prevent process exit
}

/**
 * Store a card and return its ID
 */
export function storeCard(
  card: Record<string, unknown>,
  metadata?: Record<string, unknown>,
): string {
  cleanup();
  startCleanupTimer();

  // Use full UUID (122 bits of entropy) to avoid birthday collisions
  const id = `card-${randomUUID()}`;
  // Deep-freeze metadata to prevent external mutation
  const frozenMetadata = metadata ? JSON.parse(JSON.stringify(metadata)) : undefined;
  store.set(id, { card, createdAt: Date.now(), metadata: frozenMetadata });

  // Evict oldest entries if over limit
  while (store.size > MAX_CARDS) {
    const oldest = store.keys().next().value!;
    store.delete(oldest);
  }

  return id;
}

/**
 * Retrieve a card by ID
 */
export function getCard(id: string): Record<string, unknown> | null {
  const entry = store.get(id);
  if (!entry) return null;

  if (Date.now() - entry.createdAt > DEFAULT_TTL_MS) {
    store.delete(id);
    return null;
  }

  return entry.card;
}

/**
 * List all stored card IDs with metadata (returns defensive copies)
 */
export function listCards(): Array<{ id: string; createdAt: number; metadata?: Record<string, unknown> }> {
  cleanup();
  const result: Array<{ id: string; createdAt: number; metadata?: Record<string, unknown> }> = [];
  for (const [id, entry] of store) {
    result.push({
      id,
      createdAt: entry.createdAt,
      metadata: entry.metadata ? { ...entry.metadata } : undefined,
    });
  }
  return result;
}

/**
 * Remove expired cards
 */
function cleanup(): void {
  const now = Date.now();
  for (const [id, entry] of store) {
    if (now - entry.createdAt > DEFAULT_TTL_MS) {
      store.delete(id);
    }
  }
}

/**
 * Clear all stored cards and stop cleanup timer
 */
export function clearCards(): void {
  store.clear();
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

/**
 * Resolve a card reference: if it's a string starting with "card-", look up from store.
 * Otherwise treat as inline card JSON.
 */
export function resolveCardRef(cardOrRef: unknown): Record<string, unknown> {
  if (typeof cardOrRef === "string" && cardOrRef.startsWith("card-")) {
    const stored = getCard(cardOrRef);
    if (!stored) {
      throw new Error(`Card not found: "${cardOrRef}". Cards expire after 30 minutes.`);
    }
    return stored;
  }
  if (
    cardOrRef !== null &&
    cardOrRef !== undefined &&
    typeof cardOrRef === "object" &&
    !Array.isArray(cardOrRef)
  ) {
    return cardOrRef as Record<string, unknown>;
  }
  throw new Error("Invalid card: provide a card JSON object or a card ID (e.g., 'card-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx')");
}
