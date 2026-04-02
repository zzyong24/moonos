import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { MemoryService } from "../../src/core/memory/service.js";
import { FileStorageAdapter } from "../../src/storage/file/adapter.js";
import { MEMORY_GOVERNANCE } from "../../src/protocols/memory/governance.js";

describe("MemoryService", () => {
  let tmpDir: string;
  let service: MemoryService;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "moonos-svc-test-"));
    const adapter = new FileStorageAdapter(tmpDir);
    await adapter.initialize();
    service = new MemoryService(adapter);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  // ─── Create ─────────────────────────────────────────────

  it("should create a memory with generated fields", async () => {
    const { item } = await service.create({
      type: "profile",
      title: "My preference",
      summary: "I prefer concise answers",
      content: "I prefer concise, direct answers.",
    });

    expect(item.id).toMatch(/^mem_/);
    expect(item.status).toBe("hypothesis");
    expect(item.review.policy).toBe("expiring"); // global + profile
    expect(item.expires_at).toBeDefined();
  });

  it("should return governance result on create", async () => {
    const { governance } = await service.create({
      type: "experience",
      title: "Lesson",
      summary: "Learned something",
      content: "Full content",
      scope: "project",
    });

    expect(governance.passed).toBe(true);
  });

  // ─── List / Get ─────────────────────────────────────────

  it("should list created memories", async () => {
    await service.create({ type: "experience", title: "L1", summary: "s1", content: "c1", scope: "project" });
    await service.create({ type: "experience", title: "L2", summary: "s2", content: "c2", scope: "project" });
    expect(await service.list()).toHaveLength(2);
  });

  it("should get a specific memory", async () => {
    const { item } = await service.create({ type: "policy", title: "R1", summary: "s", content: "c" });
    const fetched = await service.get(item.id);
    expect(fetched?.title).toBe("R1");
  });

  // ─── Activate ───────────────────────────────────────────

  it("should activate hypothesis → active", async () => {
    const { item: created } = await service.create({
      type: "experience", title: "Activate test", summary: "s", content: "c", scope: "project",
    });

    const { item: activated, governance } = await service.activate(created.id, "Ready to use");
    expect(activated.status).toBe("active");
    expect(activated.expires_at).toBeDefined();
    expect(activated.last_validated_at).toBeDefined();
    expect(governance.passed).toBe(true);
  });

  it("should warn about missing counter-evidence on activate for global directional", async () => {
    const { item: created } = await service.create({
      type: "policy", title: "Strategy", summary: "s", content: "c",
    });

    const { governance } = await service.activate(created.id);
    // 全局方向型没有反方锚点 → warning
    expect(governance.warnings.length).toBeGreaterThan(0);
    expect(governance.warnings.some((w) => w.rule === "memory.counter-evidence-for-active")).toBe(true);
  });

  it("should not warn if counter-evidence exists", async () => {
    const { item: created } = await service.create({
      type: "policy", title: "Strategy", summary: "s", content: "c",
      counter_evidence: ["但也有人认为这不成立"],
    });

    const { governance } = await service.activate(created.id);
    expect(governance.warnings.filter((w) => w.rule === "memory.counter-evidence-for-active")).toHaveLength(0);
  });

  // ─── Review ─────────────────────────────────────────────

  it("should review with confirm", async () => {
    const { item: created } = await service.create({ type: "policy", title: "R", summary: "s", content: "c" });
    const { item } = await service.review(created.id, "confirm", "Still valid");
    expect(item.status).toBe("active");
    expect(item.review.last_outcome).toBe("confirmed");
  });

  it("should review with delay", async () => {
    const { item: created } = await service.create({ type: "context", title: "D", summary: "s", content: "c" });
    const { item } = await service.review(created.id, "delay");
    expect(item.review.last_outcome).toBe("delayed");
  });

  it("should review with deprecate (from active)", async () => {
    const { item: created } = await service.create({
      type: "experience", title: "Dep", summary: "s", content: "c", scope: "project",
    });
    await service.review(created.id, "confirm"); // → active
    const { item } = await service.review(created.id, "deprecate", "Outdated");
    expect(item.status).toBe("deprecated");
  });

  it("should review with falsify (from active)", async () => {
    const { item: created } = await service.create({
      type: "experience", title: "Fals", summary: "s", content: "c", scope: "project",
    });
    await service.review(created.id, "confirm"); // → active
    const { item } = await service.review(created.id, "falsify", "Proven wrong");
    expect(item.status).toBe("falsified");
  });

  // ─── Counter Evidence ───────────────────────────────────

  it("should add counter-evidence", async () => {
    const { item: created } = await service.create({ type: "policy", title: "CE", summary: "s", content: "c" });
    const updated = await service.addCounterEvidence(created.id, "反方观点：可能不适用于小团队");
    expect(updated.counter_evidence).toHaveLength(1);
    expect(updated.counter_evidence[0]).toContain("反方观点");
  });

  it("should be idempotent on duplicate counter-evidence", async () => {
    const { item: created } = await service.create({ type: "policy", title: "CE2", summary: "s", content: "c" });
    await service.addCounterEvidence(created.id, "Same evidence");
    const updated = await service.addCounterEvidence(created.id, "Same evidence");
    expect(updated.counter_evidence).toHaveLength(1);
  });

  it("should remove counter-evidence", async () => {
    const { item: created } = await service.create({
      type: "policy", title: "CE3", summary: "s", content: "c",
      counter_evidence: ["evidence-1", "evidence-2"],
    });
    const updated = await service.removeCounterEvidence(created.id, "evidence-1");
    expect(updated.counter_evidence).toEqual(["evidence-2"]);
  });

  // ─── Batch Review ───────────────────────────────────────

  it("should batch delay all expired memories", async () => {
    // 创建并激活两条记忆，手动设置过期时间为过去
    const { item: m1 } = await service.create({ type: "policy", title: "B1", summary: "s", content: "c" });
    const { item: m2 } = await service.create({ type: "policy", title: "B2", summary: "s", content: "c" });

    // activate them
    await service.activate(m1.id);
    await service.activate(m2.id);

    // 直接修改存储中的 expires_at 为过去（模拟过期）
    const adapter = new FileStorageAdapter(tmpDir);
    const past = new Date(Date.now() - 86400_000).toISOString();
    for (const id of [m1.id, m2.id]) {
      const item = await adapter.get<any>("memory", id);
      await adapter.update("memory", id, { ...item, expires_at: past });
    }

    const result = await service.batchDelayAll("Batch delayed");
    expect(result.processed).toBe(2);
    expect(result.delayed).toBe(2);
  });

  // ─── Auto Downgrade ─────────────────────────────────────

  it("should auto-downgrade past grace period", async () => {
    const { item: created } = await service.create({ type: "policy", title: "AD", summary: "s", content: "c" });
    await service.activate(created.id);

    // 设置 expires_at 为很久以前（超过 grace period）
    const adapter = new FileStorageAdapter(tmpDir);
    const longPast = new Date(Date.now() - (MEMORY_GOVERNANCE.GRACE_DAYS + 5) * 86400_000).toISOString();
    const item = await adapter.get<any>("memory", created.id);
    await adapter.update("memory", created.id, { ...item, expires_at: longPast });

    const result = await service.autoDowngrade();
    expect(result.downgraded).toBe(1);
    expect(result.items[0].status).toBe("hypothesis");
    expect(result.items[0].review.last_outcome).toBe("downgraded");
  });

  // ─── Stats ──────────────────────────────────────────────

  it("should return governance stats", async () => {
    await service.create({ type: "profile", title: "S1", summary: "s", content: "c" });
    await service.create({ type: "experience", title: "S2", summary: "s", content: "c", scope: "project" });

    const stats = await service.stats();
    expect(stats.total).toBe(2);
    expect(stats.by_status.hypothesis).toBe(2);
    expect(stats.by_type.profile).toBe(1);
    expect(stats.by_type.experience).toBe(1);
  });

  // ─── Count ──────────────────────────────────────────────

  it("should count memories", async () => {
    await service.create({ type: "profile", title: "C", summary: "s", content: "c" });
    expect(await service.count()).toBe(1);
  });
});
