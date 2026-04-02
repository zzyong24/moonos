import { describe, it, expect } from "vitest";
import {
  MemoryItemSchema,
  CreateMemoryInputSchema,
  MemoryTypeSchema,
  MemoryScopeSchema,
} from "../../src/protocols/memory/schema.js";
import {
  MEMORY_GOVERNANCE,
  isGlobalDirectional,
  shouldDowngrade,
  isInReminderWindow,
  isInGracePeriod,
  validateExpiryForGlobalDirectional,
  computeExpiresAt,
} from "../../src/protocols/memory/governance.js";

describe("Memory Schema", () => {
  const now = new Date();
  const nowStr = now.toISOString();
  const futureStr = new Date(now.getTime() + 90 * 86400_000).toISOString();

  const validMemory = {
    id: "mem_test_001",
    type: "policy",
    title: "Test memory",
    summary: "A test memory item",
    content: "Full content of the test memory",
    source: "manual",
    scope: "global",
    tags: ["test"],
    status: "hypothesis",
    confidence: 0.7,
    expires_at: futureStr,
    counter_evidence: [],
    related_items: [],
    review: {
      policy: "expiring",
      next_review_at: futureStr,
      state: "scheduled",
    },
    created_at: nowStr,
    updated_at: nowStr,
  };

  it("should parse a valid memory item", () => {
    const result = MemoryItemSchema.safeParse(validMemory);
    expect(result.success).toBe(true);
  });

  it("should reject empty title", () => {
    const result = MemoryItemSchema.safeParse({ ...validMemory, title: "" });
    expect(result.success).toBe(false);
  });

  it("should reject invalid memory type", () => {
    const result = MemoryItemSchema.safeParse({ ...validMemory, type: "invalid" });
    expect(result.success).toBe(false);
  });

  it("should reject expires_at before created_at", () => {
    const pastStr = new Date(now.getTime() - 86400_000).toISOString();
    const result = MemoryItemSchema.safeParse({ ...validMemory, expires_at: pastStr });
    expect(result.success).toBe(false);
  });

  it("should accept confidence between 0 and 1", () => {
    expect(MemoryItemSchema.safeParse({ ...validMemory, confidence: 0 }).success).toBe(true);
    expect(MemoryItemSchema.safeParse({ ...validMemory, confidence: 1 }).success).toBe(true);
    expect(MemoryItemSchema.safeParse({ ...validMemory, confidence: 1.5 }).success).toBe(false);
    expect(MemoryItemSchema.safeParse({ ...validMemory, confidence: -0.1 }).success).toBe(false);
  });
});

describe("CreateMemoryInput", () => {
  it("should parse minimal input with defaults", () => {
    const result = CreateMemoryInputSchema.safeParse({
      type: "profile",
      title: "My preference",
      summary: "I prefer concise answers",
      content: "I prefer concise, direct answers without unnecessary preamble.",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.source).toBe("manual");
      expect(result.data.scope).toBe("global");
      expect(result.data.confidence).toBe(0.5);
      expect(result.data.tags).toEqual([]);
    }
  });
});

describe("Memory Governance", () => {
  it("should identify global directional memories", () => {
    expect(isGlobalDirectional({ type: "policy", scope: "global" })).toBe(true);
    expect(isGlobalDirectional({ type: "profile", scope: "global" })).toBe(true);
    expect(isGlobalDirectional({ type: "context", scope: "global" })).toBe(true);
    expect(isGlobalDirectional({ type: "experience", scope: "global" })).toBe(false);
    expect(isGlobalDirectional({ type: "policy", scope: "project" })).toBe(false);
  });

  it("should detect memories needing downgrade", () => {
    const now = new Date();
    const pastExpiry = new Date(now.getTime() - (MEMORY_GOVERNANCE.GRACE_DAYS + 1) * 86400_000).toISOString();

    const item = {
      status: "active" as const,
      expires_at: pastExpiry,
    };

    // shouldDowngrade needs full MemoryItem, but we only check status + expires_at
    expect(shouldDowngrade(item as any, now)).toBe(true);
  });

  it("should detect reminder window", () => {
    const now = new Date();
    const soonExpiry = new Date(now.getTime() + 3 * 86400_000).toISOString(); // expires in 3 days

    const item = {
      status: "active" as const,
      expires_at: soonExpiry,
    };

    expect(isInReminderWindow(item as any, now)).toBe(true);
  });

  it("should validate global directional expiry limit", () => {
    const now = new Date();
    const tooFar = new Date(now.getTime() + 200 * 86400_000).toISOString();

    const result = validateExpiryForGlobalDirectional({
      type: "policy",
      scope: "global",
      created_at: now.toISOString(),
      expires_at: tooFar,
    });

    expect(result).toContain("180");
  });

  it("should compute expires_at correctly", () => {
    const base = new Date("2026-01-01T00:00:00.000Z");
    const result = computeExpiresAt(base, 30);
    expect(new Date(result).getTime()).toBe(base.getTime() + 30 * 86400_000);
  });
});
