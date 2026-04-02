/**
 * Workflow Protocol v0.3 — exploit/explore/chaos 三类可迁移工作流。
 *
 * 核心设计：
 * - 节点类型：tool / agent / condition / input / output（discriminated union）
 * - resolver_policy：参数补齐策略（direct → schema-match → vault-place → llm）
 * - 节点级 override
 */
import { z } from "zod";
import { NonEmptyString, SemverString, StringMap, CURRENT_PROTOCOL_VERSION } from "../_shared/base.js";
import { buildJsonSchemaDoc, extractRequiredFields } from "../_shared/json-schema.js";

// ─── Enums ────────────────────────────────────────────────────

export const WorkflowClassSchema = z.enum(["exploit", "explore", "chaos"]);
export type WorkflowClass = z.infer<typeof WorkflowClassSchema>;

export const ResolveStrategySchema = z.enum(["direct", "schema-match", "vault-place", "llm"]);
export type ResolveStrategy = z.infer<typeof ResolveStrategySchema>;

const RuntimeApprovalSchema = z.enum(["never", "optional", "required"]);

// ─── Resolver Policy ──────────────────────────────────────────

export const ResolverPolicySchema = z.object({
  enabled: z.boolean().default(true),
  strategy_order: z.array(ResolveStrategySchema).min(1).default(["direct", "schema-match", "vault-place", "llm"]),
  llm_fallback: z.enum(["disabled", "fallback-only", "allowed"]).default("fallback-only"),
  record_reasoning: z.boolean().default(true),
  record_trace_core: z.literal(true).default(true),
  replay_prefers_trace_params: z.literal(true).default(true),
  allow_vault_place_for_save_tools: z.boolean().default(true),
});
export type ResolverPolicy = z.infer<typeof ResolverPolicySchema>;

export const NodeResolvePolicySchema = z.object({
  mode: z.enum(["inherit", "override"]).default("inherit"),
  allowed_strategies: z.array(ResolveStrategySchema).min(1).default(["direct", "schema-match", "vault-place"]),
  disable_llm: z.boolean().default(false),
  required_manual_fields: z.array(NonEmptyString).default([]),
  record_reasoning: z.boolean().optional(),
});
export type NodeResolvePolicy = z.infer<typeof NodeResolvePolicySchema>;

// ─── Workflow Nodes (discriminated union) ──────────────────────

const NodeBase = z.object({
  id: NonEmptyString,
  input_contract: StringMap.default({}),
  output_contract: StringMap.default({}),
  resolve_policy: NodeResolvePolicySchema.optional(),
  notes: z.string().optional(),
});

export const WorkflowNodeSchema = z.discriminatedUnion("type", [
  NodeBase.extend({ type: z.literal("tool"), tool: NonEmptyString }),
  NodeBase.extend({ type: z.literal("agent"), agent_role: NonEmptyString }),
  NodeBase.extend({ type: z.literal("condition") }),
  NodeBase.extend({ type: z.literal("input") }),
  NodeBase.extend({ type: z.literal("output") }),
]);
export type WorkflowNode = z.infer<typeof WorkflowNodeSchema>;

const WorkflowEdgeSchema = z.object({
  from: NonEmptyString,
  to: NonEmptyString,
  label: z.string().optional(),
});

// ─── Workflow Protocol ────────────────────────────────────────

export const WorkflowProtocolSchema = z.object({
  id: NonEmptyString,
  name: NonEmptyString,
  version: SemverString,
  workflow_class: WorkflowClassSchema,
  nodes: z.array(WorkflowNodeSchema).min(1),
  edges: z.array(WorkflowEdgeSchema),
  resolver_policy: ResolverPolicySchema,
  policy: z.object({
    retry: z.number().int().min(0).max(5).default(0),
    approval: RuntimeApprovalSchema.default("optional"),
    trace_level: z.enum(["minimal", "standard", "full"]).default("standard"),
  }),
});
export type WorkflowProtocol = z.infer<typeof WorkflowProtocolSchema>;

// ─── JSON Schema ──────────────────────────────────────────────

export const WorkflowJsonSchema = buildJsonSchemaDoc(WorkflowProtocolSchema, {
  $id: `moonos/protocols/workflow/v${CURRENT_PROTOCOL_VERSION}`,
  title: "MoonOS Workflow Protocol",
  description: "可迁移的工作流表达，同时保留 explore / chaos 入口。",
});
export const WorkflowRequiredFields = extractRequiredFields(WorkflowJsonSchema);
