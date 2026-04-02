import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { FileStorageAdapter } from "../../src/storage/file/adapter.js";
import { MemoryService } from "../../src/core/memory/service.js";
import { exportBundle } from "../../src/core/bundle/exporter.js";
import { importBundle, parseBundle } from "../../src/core/bundle/importer.js";

describe("Bundle Export/Import", () => {
  let tmpDir: string;
  let tmpDir2: string;
  let adapter: FileStorageAdapter;
  let adapter2: FileStorageAdapter;
  let memService: MemoryService;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "moonos-bundle-test-"));
    tmpDir2 = await fs.mkdtemp(path.join(os.tmpdir(), "moonos-bundle-test2-"));
    adapter = new FileStorageAdapter(tmpDir);
    adapter2 = new FileStorageAdapter(tmpDir2);
    await adapter.initialize();
    await adapter2.initialize();
    memService = new MemoryService(adapter);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
    await fs.rm(tmpDir2, { recursive: true, force: true });
  });

  it("should export an empty workspace", async () => {
    const bundle = await exportBundle(adapter);
    expect(bundle.assets).toHaveLength(0);
    expect(bundle.bundle_type).toBe("export");
  });

  it("should export memories", async () => {
    await memService.create({ type: "profile", title: "T1", summary: "s", content: "c" });
    await memService.create({ type: "experience", title: "T2", summary: "s", content: "c", scope: "project" });

    const bundle = await exportBundle(adapter);
    expect(bundle.assets).toHaveLength(2);
    expect(bundle.manifest.asset_counts.memory).toBe(2);
    expect(bundle.assets[0].asset_type).toBe("memory");
    expect(bundle.assets[0].hash).toMatch(/^sha256:/);
  });

  it("should round-trip export → import into new workspace", async () => {
    await memService.create({ type: "policy", title: "Round Trip", summary: "s", content: "c" });

    const bundle = await exportBundle(adapter);
    const result = await importBundle(adapter2, bundle);

    expect(result.status).toBe("completed");
    expect(result.imported).toBe(1);
    expect(result.conflicts).toHaveLength(0);

    // 验证新 workspace 有数据
    const items = await adapter2.list("memory");
    expect(items).toHaveLength(1);
  });

  it("should detect conflicts on re-import", async () => {
    const { item } = await memService.create({ type: "policy", title: "Conflict", summary: "s", content: "original" });

    const bundle = await exportBundle(adapter);

    // 修改原 workspace 中的记忆
    await adapter.update("memory", item.id, { ...item, content: "modified", updated_at: new Date().toISOString() });

    // 重新导入 → 应检测到冲突
    const result = await importBundle(adapter, bundle, { policy: "skip" });
    expect(result.conflicts.length).toBeGreaterThan(0);
    expect(result.skipped).toBeGreaterThan(0);
  });

  it("should overwrite on policy=overwrite", async () => {
    const { item } = await memService.create({ type: "policy", title: "Overwrite", summary: "s", content: "v1" });

    // 手动修改
    await adapter.update("memory", item.id, { ...item, content: "v2", updated_at: new Date().toISOString() });

    // 导出 v2
    const bundle = await exportBundle(adapter);

    // 改回 v1
    await adapter.update("memory", item.id, { ...item, content: "v1-restored", updated_at: new Date().toISOString() });

    // 导入 v2 with overwrite
    const result = await importBundle(adapter, bundle, { policy: "overwrite" });
    expect(result.overwritten).toBeGreaterThan(0);

    const final = await adapter.get<any>("memory", item.id);
    expect(final.content).toBe("v2");
  });

  it("should keep both on policy=keep_both", async () => {
    const { item } = await memService.create({ type: "policy", title: "KeepBoth", summary: "s", content: "original" });

    const bundle = await exportBundle(adapter);

    // 修改
    await adapter.update("memory", item.id, { ...item, content: "modified" });

    const result = await importBundle(adapter, bundle, { policy: "keep_both" });
    expect(result.imported).toBeGreaterThan(0);

    // 应该有两条
    const all = await adapter.list("memory");
    expect(all.length).toBe(2);
  });

  it("should parse bundle from raw JSON", () => {
    const raw = {
      bundle_id: "b1", bundle_version: "0.1.0", created_at: new Date().toISOString(),
      source_system: "moonos", bundle_type: "export",
      manifest: { protocol_catalog_version: "0.3.0", asset_counts: {} },
      assets: [], references: [],
    };
    const bundle = parseBundle(raw);
    expect(bundle.bundle_id).toBe("b1");
  });
});
