import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { TraceService } from "../../src/core/trace/service.js";
import { FileStorageAdapter } from "../../src/storage/file/adapter.js";

describe("TraceService", () => {
  let tmpDir: string;
  let service: TraceService;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "moonos-trace-test-"));
    const adapter = new FileStorageAdapter(tmpDir);
    await adapter.initialize();
    service = new TraceService(adapter);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should start a trace with session_started event", async () => {
    const t = await service.startTrace("sess_001", "wf_test");
    expect(t.trace_id).toMatch(/^trace_/);
    expect(t.session_id).toBe("sess_001");
    expect(t.workflow_id).toBe("wf_test");
    expect(t.status).toBe("partial");
    expect(t.events).toHaveLength(1);
    expect(t.events[0].type).toBe("session_started");
  });

  it("should append events", async () => {
    const t = await service.startTrace("sess_002");
    const t2 = await service.appendEvent(t.trace_id, {
      type: "tool_called",
      node_id: "collect",
      payload: { tool: "collect_content", url: "https://example.com" },
    });
    expect(t2.events).toHaveLength(2);
    expect(t2.events[1].type).toBe("tool_called");
    expect(t2.events[1].node_id).toBe("collect");
  });

  it("should append param_resolved with validated payload", async () => {
    const t = await service.startTrace("sess_003");
    const t2 = await service.appendParamResolved(t.trace_id, "save_node", {
      field_name: "output_path",
      resolved_value: "/vault/notes/test.md",
      strategy_used: "vault-place",
      context_refs: ["mem_001"],
      reasoning_snippet: "根据 save 工具 schema 解析路径。",
      replay_source: "resolver",
    });
    expect(t2.events).toHaveLength(2);
    expect(t2.events[1].type).toBe("param_resolved");
  });

  it("should finalize trace with status and lessons", async () => {
    const t = await service.startTrace("sess_004");
    await service.appendEvent(t.trace_id, { type: "output_saved", payload: { path: "/test" } });
    const finalized = await service.finalize(t.trace_id, "success", {
      lessons: ["输出路径需要检查是否存在"],
      counterfactuals: ["如果用了不同模型，输出可能更简洁"],
    });
    expect(finalized.status).toBe("success");
    expect(finalized.lessons).toHaveLength(1);
    expect(finalized.counterfactuals).toHaveLength(1);
  });

  it("should list and count traces", async () => {
    await service.startTrace("sess_a");
    await service.startTrace("sess_b");
    const list = await service.list();
    expect(list).toHaveLength(2);
    expect(await service.count()).toBe(2);
  });

  it("should get a trace by ID", async () => {
    const t = await service.startTrace("sess_get");
    const fetched = await service.get(t.trace_id);
    expect(fetched).toBeDefined();
    expect(fetched?.session_id).toBe("sess_get");
  });

  it("should summarize a trace", async () => {
    const t = await service.startTrace("sess_sum");
    await service.appendEvent(t.trace_id, { type: "tool_called", node_id: "n1" });
    await service.appendEvent(t.trace_id, { type: "error_raised", node_id: "n1", payload: { error: "timeout" } });
    await service.appendEvent(t.trace_id, { type: "hypothesis_falsified", payload: { hypothesis: "test", evidence: "proof" } });

    const latest = await service.get(t.trace_id);
    const summary = service.summarize(latest!);
    expect(summary.event_count).toBe(4);
    expect(summary.has_failures).toBe(true);
    expect(summary.has_falsifications).toBe(true);
    expect(summary.event_groups.tool).toBe(2);
    expect(summary.event_groups.memory).toBe(1);
  });

  it("should extract falsified hypotheses", async () => {
    const t = await service.startTrace("sess_fals");
    await service.appendEvent(t.trace_id, {
      type: "hypothesis_falsified",
      payload: { hypothesis: "用户只需要开发者功能", evidence: "非技术用户也有需求" },
    });

    const falsified = await service.extractFalsifiedHypotheses();
    expect(falsified).toHaveLength(1);
    expect(falsified[0].hypothesis).toContain("开发者");
  });

  it("should extract failed paths", async () => {
    const t = await service.startTrace("sess_fail");
    await service.appendEvent(t.trace_id, {
      type: "error_raised",
      node_id: "save",
      payload: { error: "File not found" },
    });

    const failed = await service.extractFailedPaths();
    expect(failed).toHaveLength(1);
    expect(failed[0].error).toBe("File not found");
    expect(failed[0].node_id).toBe("save");
  });
});
