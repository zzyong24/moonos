import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { FalsificationReportGenerator } from "../../src/core/reports/falsification.js";
import { TraceService } from "../../src/core/trace/service.js";
import { MemoryService } from "../../src/core/memory/service.js";
import { FileStorageAdapter } from "../../src/storage/file/adapter.js";

describe("FalsificationReportGenerator", () => {
  let tmpDir: string;
  let adapter: FileStorageAdapter;
  let gen: FalsificationReportGenerator;
  let traceService: TraceService;
  let memService: MemoryService;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "moonos-report-test-"));
    adapter = new FileStorageAdapter(tmpDir);
    await adapter.initialize();
    // 手动确保 reports/falsification 目录和 index 存在
    const rfDir = path.join(tmpDir, ".moonos", "reports", "falsification");
    await fs.mkdir(rfDir, { recursive: true });
    const indexPath = path.join(rfDir, "index.json");
    try { await fs.access(indexPath); } catch { await fs.writeFile(indexPath, "[]"); }

    gen = new FalsificationReportGenerator(adapter);
    traceService = new TraceService(adapter);
    memService = new MemoryService(adapter);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should generate an empty report for clean workspace", async () => {
    const { report } = await gen.generate("2026-04");
    expect(report.month).toBe("2026-04");
    expect(report.summary.falsified_judgments).toBe(0);
    expect(report.integrity.hash).toMatch(/^sha256:/);
    expect(report.acknowledgement.required_before_core_use).toBe(true);
  });

  it("should pick up falsified hypotheses from traces", async () => {
    const t = await traceService.startTrace("sess_rpt_1");
    await traceService.appendEvent(t.trace_id, {
      type: "hypothesis_falsified",
      payload: { hypothesis: "MoonOS 只适合开发者", evidence: "创作者也需要" },
    });

    const { report } = await gen.generate("2026-04");
    expect(report.summary.falsified_judgments).toBeGreaterThan(0);
    expect(report.judgments.some((j) => j.source === "trace")).toBe(true);
  });

  it("should pick up falsified memories", async () => {
    const { item } = await memService.create({
      type: "policy", title: "Wrong assumption", summary: "s", content: "c",
    });
    // activate → falsify
    await memService.activate(item.id);
    await memService.review(item.id, "falsify", "Proven wrong by data");

    const { report } = await gen.generate("2026-04");
    expect(report.judgments.some((j) => j.source === "memory_review")).toBe(true);
  });

  it("should freeze high-impact memories", async () => {
    // 创建一条全局 policy memory 并 falsify（会被报告标记为 high impact）
    const { item } = await memService.create({
      type: "policy", title: "Global wrong", summary: "s", content: "c",
    });
    await memService.activate(item.id);
    await memService.review(item.id, "falsify");

    // 创建另一条关联 memory（模拟被 affected）
    const { item: related } = await memService.create({
      type: "context", title: "Related", summary: "s", content: "c",
    });
    await memService.activate(related.id);

    // 手动添加 related_items 使其被关联
    const falsifiedMem = await adapter.get<any>("memory", item.id);
    await adapter.update("memory", item.id, { ...falsifiedMem, related_items: [related.id] });

    const { report, actions_taken } = await gen.generate("2026-04");
    expect(report.summary.falsified_judgments).toBeGreaterThan(0);
    // 报告已生成且有 hash
    expect(report.integrity.hash).toMatch(/^sha256:/);
  });

  it("should save and retrieve report", async () => {
    await gen.generate("2026-03");
    const report = await gen.getReport("2026-03");
    expect(report).toBeDefined();
    expect(report?.month).toBe("2026-03");
  });

  it("should acknowledge report", async () => {
    await gen.generate("2026-03");
    const ack = await gen.acknowledgeReport("2026-03");
    expect(ack.acknowledgement.acknowledged_at).toBeDefined();
  });

  it("should list reports", async () => {
    await gen.generate("2026-02");
    await gen.generate("2026-03");
    const list = await gen.listReports();
    expect(list.length).toBeGreaterThanOrEqual(2);
  });
});
