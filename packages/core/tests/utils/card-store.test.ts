/**
 * Tests for card store
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { storeCard, getCard, listCards, clearCards, resolveCardRef } from "../../src/utils/card-store.js";

describe("Card Store", () => {
  beforeEach(() => {
    clearCards();
  });

  it("should store and retrieve a card", () => {
    const card = { type: "AdaptiveCard", version: "1.6", body: [] };
    const id = storeCard(card);

    expect(id).toMatch(/^card-/);
    expect(getCard(id)).toEqual(card);
  });

  it("should list stored cards", () => {
    storeCard({ type: "AdaptiveCard", body: [] }, { tool: "test" });
    storeCard({ type: "AdaptiveCard", body: [] }, { tool: "test2" });

    const cards = listCards();
    expect(cards).toHaveLength(2);
    expect(cards[0].metadata).toEqual({ tool: "test" });
  });

  it("should return null for unknown ID", () => {
    expect(getCard("card-nonexistent")).toBeNull();
  });

  it("should resolve card references", () => {
    const card = { type: "AdaptiveCard", version: "1.6", body: [] };
    const id = storeCard(card);

    // Resolve by ID
    expect(resolveCardRef(id)).toEqual(card);

    // Resolve inline object
    expect(resolveCardRef(card)).toEqual(card);
  });

  it("should throw for invalid card reference", () => {
    expect(() => resolveCardRef("card-nonexistent")).toThrow(/Card not found/);
    expect(() => resolveCardRef(42)).toThrow(/Invalid card/);
    expect(() => resolveCardRef(null)).toThrow(/Invalid card/);
    expect(() => resolveCardRef([1, 2])).toThrow(/Invalid card/);
    expect(() => resolveCardRef(true)).toThrow(/Invalid card/);
  });

  it("should clear all cards", () => {
    storeCard({ type: "AdaptiveCard", body: [] });
    storeCard({ type: "AdaptiveCard", body: [] });
    expect(listCards()).toHaveLength(2);

    clearCards();
    expect(listCards()).toHaveLength(0);
  });

  it("should expire cards after TTL", () => {
    const card = { type: "AdaptiveCard", version: "1.6", body: [] };
    const id = storeCard(card);

    // Card should be retrievable now
    expect(getCard(id)).toEqual(card);

    // Advance time past TTL (30 minutes = 1800000ms)
    const realDateNow = Date.now;
    Date.now = vi.fn(() => realDateNow() + 31 * 60 * 1000);

    // Card should be expired
    expect(getCard(id)).toBeNull();

    // Restore Date.now
    Date.now = realDateNow;
  });

  it("should return defensive copy of metadata in listCards", () => {
    const metadata = { tool: "test", extra: "data" };
    storeCard({ type: "AdaptiveCard", body: [] }, metadata);

    const cards = listCards();
    // Mutating returned metadata should not affect stored metadata
    cards[0].metadata!.tool = "mutated";

    const cardsAgain = listCards();
    expect(cardsAgain[0].metadata!.tool).toBe("test"); // Still original
  });

  it("should use full UUID for card IDs", () => {
    const id = storeCard({ type: "AdaptiveCard", body: [] });
    // Full UUID format: card-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    expect(id).toMatch(/^card-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});
