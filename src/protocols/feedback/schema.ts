/**
 * External Feedback Protocol v0.3 — credibility + weight + resolution 回流。
 */
import { z } from "zod";
import { NonEmptyString, IsoDateTimeString, UnitInterval, CURRENT_PROTOCOL_VERSION } from "../_shared/base.js";
import { buildJsonSchemaDoc, extractRequiredFields } from "../_shared/json-schema.js";

export const FeedbackSourceTypeSchema = z.enum(["user_usage", "market", "community", "analytics", "adapter", "user_comment", "anonymous"]);
export type FeedbackSourceType = z.infer<typeof FeedbackSourceTypeSchema>;

export const FeedbackStanceSchema = z.enum(["supportive", "neutral", "critical", "contradictory"]);
export const FeedbackSeveritySchema = z.enum(["low", "medium", "high", "critical"]);
export const FeedbackResolutionStatusSchema = z.enum(["pending_review", "accepted", "rejected", "archived", "proposal_created"]);

const ResolutionTargetSchema = z.object({
  asset_type: NonEmptyString,
  asset_id: NonEmptyString,
  action: NonEmptyString,
});

export const FeedbackResolutionSchema = z.object({
  status: FeedbackResolutionStatusSchema,
  severity: FeedbackSeveritySchema,
  decision: NonEmptyString,
  owner: NonEmptyString,
  auto_triggered: z.boolean().default(false),
  targets: z.array(ResolutionTargetSchema).default([]),
  review_by: IsoDateTimeString.optional(),
});
export type FeedbackResolution = z.infer<typeof FeedbackResolutionSchema>;

export const ExternalFeedbackSchema = z.object({
  feedback_id: NonEmptyString,
  source_type: FeedbackSourceTypeSchema,
  stance: FeedbackStanceSchema,
  credibility: UnitInterval,
  weight: UnitInterval,
  summary: NonEmptyString,
  content: NonEmptyString,
  linked_assets: z.array(NonEmptyString).default([]),
  action_required: z.boolean().default(false),
  suggested_action: z.string().optional(),
  resolution: FeedbackResolutionSchema,
  created_at: IsoDateTimeString,
});
export type ExternalFeedback = z.infer<typeof ExternalFeedbackSchema>;

// ─── JSON Schema ──────────────────────────────────────────────

export const FeedbackJsonSchema = buildJsonSchemaDoc(ExternalFeedbackSchema, {
  $id: `moonos/protocols/external-feedback/v${CURRENT_PROTOCOL_VERSION}`,
  title: "MoonOS External Feedback Protocol",
  description: "将外部质疑、阻力和负反馈结构化沉淀为可回流资产。",
});
export const FeedbackRequiredFields = extractRequiredFields(FeedbackJsonSchema);
