import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { FileStorageAdapter } from "../../src/storage/file/adapter.js";

describe("FileStorageAdapter", () => {
  let tmpDir: string;
  let adapter: FileStorageAdapter;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "moonos-test-"));
    adapter = new FileStorageAdapter(tmpDir);
    await adapter.initialize();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should initialize workspace structure", async () => {
    expect(await adapter.isInitialized()).toBe(true);
  });

  it("should create and get an item", async () => {
    const item = { id: "test-1", name: "foo", updated_at: new Date().toISOString() };
    await adapter.create("memory", item);

    const result = await adapter.get("memory", "test-1");
    expect(result).toEqual(item);
  });

  it("should list items", async () => {
    const now = new Date().toISOString();
    await adapter.create("memory", { id: "a", name: "first", updated_at: now });
    await adapter.create("memory", { id: "b", name: "second", updated_at: now });

    const items = await adapter.list("memory");
    expect(items).toHaveLength(2);
  });

  it("should update an item", async () => {
    const now = new Date().toISOString();
    await adapter.create("memory", { id: "u1", name: "original", updated_at: now });
    await adapter.update("memory", "u1", { id: "u1", name: "updated", updated_at: now });

    const result = await adapter.get<{ id: string; name: string }>("memory", "u1");
    expect(result?.name).toBe("updated");
  });

  it("should delete an item", async () => {
    const now = new Date().toISOString();
    await adapter.create("memory", { id: "d1", name: "to-delete", updated_at: now });
    const deleted = await adapter.delete("memory", "d1");
    expect(deleted).toBe(true);

    const result = await adapter.get("memory", "d1");
    expect(result).toBeNull();
  });

  it("should return null for non-existent item", async () => {
    const result = await adapter.get("memory", "nonexistent");
    expect(result).toBeNull();
  });

  it("should reject duplicate creation", async () => {
    const now = new Date().toISOString();
    await adapter.create("memory", { id: "dup", name: "first", updated_at: now });
    await expect(
      adapter.create("memory", { id: "dup", name: "second", updated_at: now }),
    ).rejects.toThrow("already exists");
  });

  it("should count items", async () => {
    const now = new Date().toISOString();
    await adapter.create("memory", { id: "c1", updated_at: now });
    await adapter.create("memory", { id: "c2", updated_at: now });

    const count = await adapter.count("memory");
    expect(count).toBe(2);
  });

  it("should get workspace stats", async () => {
    const now = new Date().toISOString();
    await adapter.create("memory", { id: "s1", updated_at: now });

    const stats = await adapter.getStats();
    expect(stats.collections.memory.count).toBe(1);
    expect(stats.totalFiles).toBe(1);
  });
});
