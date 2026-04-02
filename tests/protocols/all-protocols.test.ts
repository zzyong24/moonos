import { describe, it, expect } from "vitest";
import { SkillContractSchema } from "../../src/protocols/skill/schema.js";
import { validateStrategicSkill, isStrategicSkill } from "../../src/protocols/skill/governance.js";
import { WorkflowProtocolSchema } from "../../src/protocols/workflow/schema.js";
import { TraceProtocolSchema, TraceEventTypeSchema, TRACE_EVENT_GROUPS } from "../../src/protocols/trace/schema.js";
import { ExternalFeedbackSchema } from "../../src/protocols/feedback/schema.js";
import { canAutoPropose } from "../../src/protocols/feedback/governance.js";
import { AssetBundleSchema, AssetEnvelopeSchema } from "../../src/protocols/envelope/schema.js";
import { PROTOCOL_CATALOG, SUPPORTING_OBJECT_CATALOG, getCatalogEntry } from "../../src/protocols/catalog.js";

// ─── Skill ────────────────────────────────────────────────────

describe("Skill Protocol", () => {
  const validContract = {
    id: "skill_test", name: "Test Skill", description: "A test", category: "strategy",
    triggers: ["test"], input_contract: { input: "string" },
    output_contract: { type: "markdown", sections: ["分析", "风险与反例"] },
    constraints: ["先分析后结论", "至少提出一个反方视角"],
    evaluation: { must_include: ["边界", "方案对比"], anti_patterns: ["直接跳实现"] },
    version: "0.3.0",
  };

  it("should parse a valid skill contract", () => {
    expect(SkillContractSchema.safeParse(validContract).success).toBe(true);
  });

  it("should identify strategic skills", () => {
    expect(isStrategicSkill(SkillContractSchema.parse(validContract))).toBe(true);
    expect(isStrategicSkill(SkillContractSchema.parse({ ...validContract, category: "utility" }))).toBe(false);
  });

  it("should validate strategic skill constraints", () => {
    const skill = SkillContractSchema.parse(validContract);
    expect(validateStrategicSkill(skill)).toBeNull(); // passes

    const noCounter = SkillContractSchema.parse({ ...validContract, constraints: ["先分析后结论"] });
    expect(validateStrategicSkill(noCounter)).toContain("反方视角");
  });
});

// ─── Workflow ─────────────────────────────────────────────────

describe("Workflow Protocol", () => {
  it("should parse a valid workflow", () => {
    const wf = {
      id: "wf_test", name: "Test", version: "0.3.0", workflow_class: "exploit",
      nodes: [{ id: "n1", type: "tool", tool: "do_thing", input_contract: {}, output_contract: {} }],
      edges: [],
      resolver_policy: { enabled: true },
      policy: { retry: 1, approval: "optional" },
    };
    expect(WorkflowProtocolSchema.safeParse(wf).success).toBe(true);
  });

  it("should support all workflow classes", () => {
    for (const cls of ["exploit", "explore", "chaos"]) {
      const wf = {
        id: "wf", name: "T", version: "0.3.0", workflow_class: cls,
        nodes: [{ id: "n", type: "input" }], edges: [],
        resolver_policy: { enabled: true }, policy: {},
      };
      expect(WorkflowProtocolSchema.safeParse(wf).success).toBe(true);
    }
  });

  it("should support discriminated union node types", () => {
    const wf = {
      id: "wf", name: "T", version: "0.3.0", workflow_class: "exploit",
      nodes: [
        { id: "n1", type: "tool", tool: "collect" },
        { id: "n2", type: "agent", agent_role: "reader" },
        { id: "n3", type: "condition" },
        { id: "n4", type: "input" },
        { id: "n5", type: "output" },
      ],
      edges: [{ from: "n1", to: "n2" }],
      resolver_policy: { enabled: true }, policy: {},
    };
    expect(WorkflowProtocolSchema.safeParse(wf).success).toBe(true);
  });
});

// ─── Trace ────────────────────────────────────────────────────

describe("Trace Protocol", () => {
  it("should parse a valid trace", () => {
    const trace = {
      trace_id: "t1", session_id: "s1", status: "success",
      events: [{ ts: new Date().toISOString(), type: "session_started", payload: {} }],
    };
    expect(TraceProtocolSchema.safeParse(trace).success).toBe(true);
  });

  it("should cover all 16 event types", () => {
    expect(TraceEventTypeSchema.options).toHaveLength(16);
  });

  it("should group events correctly", () => {
    const allGrouped = Object.values(TRACE_EVENT_GROUPS).flat();
    expect(allGrouped).toHaveLength(16);
  });
});

// ─── Feedback ─────────────────────────────────────────────────

describe("External Feedback Protocol", () => {
  it("should parse valid feedback", () => {
    const fb = {
      feedback_id: "fb1", source_type: "user_usage", stance: "critical",
      credibility: 0.8, weight: 1.0, summary: "Too abstract", content: "Users can't understand it",
      resolution: { status: "pending_review", severity: "high", decision: "Rewrite positioning", owner: "product" },
      created_at: new Date().toISOString(),
    };
    expect(ExternalFeedbackSchema.safeParse(fb).success).toBe(true);
  });

  it("should enforce auto-proposal threshold", () => {
    expect(canAutoPropose(0.8, 0.6)).toBe(true);
    expect(canAutoPropose(0.5, 0.8)).toBe(false); // credibility too low
    expect(canAutoPropose(0.8, 0.3)).toBe(false); // weight too low
  });
});

// ─── Envelope ─────────────────────────────────────────────────

describe("Envelope & Bundle", () => {
  it("should parse a valid envelope", () => {
    const env = {
      asset_id: "mem1", asset_type: "memory", protocol_version: "0.3.0",
      schema_id: "moonos/protocols/memory/v0.3.0",
      hash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      source_system: "moonos", exported_at: new Date().toISOString(),
      payload: { id: "mem1" },
    };
    expect(AssetEnvelopeSchema.safeParse(env).success).toBe(true);
  });

  it("should parse a valid bundle", () => {
    const bundle = {
      bundle_id: "b1", bundle_version: "0.1.0", created_at: new Date().toISOString(),
      source_system: "moonos", bundle_type: "export",
      manifest: { protocol_catalog_version: "0.3.0", asset_counts: { memory: 1 } },
      assets: [],
    };
    expect(AssetBundleSchema.safeParse(bundle).success).toBe(true);
  });
});

// ─── Catalog ──────────────────────────────────────────────────

describe("Protocol Catalog", () => {
  it("should have 6 protocols", () => {
    expect(PROTOCOL_CATALOG).toHaveLength(6);
  });

  it("should have 4 supporting objects", () => {
    expect(SUPPORTING_OBJECT_CATALOG).toHaveLength(4);
  });

  it("should find entry by ID", () => {
    expect(getCatalogEntry("memory")).toBeDefined();
    expect(getCatalogEntry("workflow")).toBeDefined();
    expect(getCatalogEntry("asset-bundle")).toBeDefined();
    expect(getCatalogEntry("nonexistent")).toBeUndefined();
  });
});
