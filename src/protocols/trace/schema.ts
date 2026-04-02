/**
 * Trace Protocol v0.3 — 最小可观测、可复现、可校准的执行痕迹。
 *
 * 16 种事件类型，分为 6 组：session / memory / skill / tool / output / feedback
 * param_resolved 事件必须保留核心复现数据，不管 record_reasoning 开关。
 */
import { z } from "zod";
import { NonEmptyString, IsoDateTimeString, CURRENT_PROTOCOL_VERSION } from "../_shared/base.js";
import { ResolveStrategySchema } from "../workflow/schema.js";
import { buildJsonSchemaDoc, extractRequiredFields } from "../_shared/json-schema.js";

// ─── Event Types ──────────────────────────────────────────────

export const TraceEventTypeSchema = z.enum([
  "session_started", "context_loaded",
  "memory_injected", "hypothesis_falsified", "contradiction_found",
  "skill_selected", "agent_reasoned",
  "tool_called", "tool_returned", "param_resolved", "retry_triggered", "error_raised", "path_failed",
  "output_saved",
  "unexpected_feedback", "external_feedback_ingested",
]);
export type TraceEventType = z.infer<typeof TraceEventTypeSchema>;

export const TRACE_EVENT_GROUPS = {
  session: ["session_started", "context_loaded"],
  memory: ["memory_injected", "hypothesis_falsified", "contradiction_found"],
  skill: ["skill_selected", "agent_reasoned"],
  tool: ["tool_called", "tool_returned", "param_resolved", "retry_triggered", "error_raised", "path_failed"],
  output: ["output_saved"],
  feedback: ["unexpected_feedback", "external_feedback_ingested"],
} as const satisfies Record<string, readonly TraceEventType[]>;

export type TraceEventGroup = keyof typeof TRACE_EVENT_GROUPS;

// ─── Param Resolved Payload ───────────────────────────────────

export const ParamResolvedPayloadSchema = z.object({
  field_name: NonEmptyString,
  resolved_value: z.unknown(),
  strategy_used: ResolveStrategySchema,
  context_refs: z.array(NonEmptyString).default([]),
  reasoning_snippet: z.string().default(""),
  replay_source: z.enum(["resolver", "trace"]).default("resolver"),
});
export type ParamResolvedPayload = z.infer<typeof ParamResolvedPayloadSchema>;

// ─── Trace Events & Protocol ──────────────────────────────────

const TraceEventSchema = z.object({
  ts: IsoDateTimeString,
  type: TraceEventTypeSchema,
  node_id: NonEmptyString.optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export const TraceStatusSchema = z.enum(["success", "failed", "partial", "falsified"]);

export const TraceProtocolSchema = z.object({
  trace_id: NonEmptyString,
  session_id: NonEmptyString,
  workflow_id: NonEmptyString.optional(),
  status: TraceStatusSchema,
  events: z.array(TraceEventSchema).min(1),
  lessons: z.array(NonEmptyString).default([]),
  counterfactuals: z.array(NonEmptyString).default([]),
});
export type TraceProtocol = z.infer<typeof TraceProtocolSchema>;

// ─── JSON Schema ──────────────────────────────────────────────

export const TraceJsonSchema = buildJsonSchemaDoc(TraceProtocolSchema, {
  $id: `moonos/protocols/trace/v${CURRENT_PROTOCOL_VERSION}`,
  title: "MoonOS Trace Protocol",
  description: "最小可观测、可复现、可校准的执行痕迹对象。",
});
export const TraceRequiredFields = extractRequiredFields(TraceJsonSchema);

export const ParamResolvedJsonSchema = buildJsonSchemaDoc(ParamResolvedPayloadSchema, {
  $id: `moonos/supporting/param-resolved-trace-payload/v${CURRENT_PROTOCOL_VERSION}`,
  title: "MoonOS Param Resolved Trace Payload",
  description: "param_resolved 事件的强制核心复现数据。",
});
