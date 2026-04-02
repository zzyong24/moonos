/**
 * Memory Protocol v0.3 — 可迁移、可治理、可证伪的记忆对象。
 *
 * 记忆不默认是真理，而默认是可被验证、可被废弃的对象。
 * 设计要点：
 * - 4 类记忆：profile / context / experience / policy
 * - 5 态生命周期：hypothesis → active → deprecated / falsified → archived
 * - review 子对象管理复审策略（180天到期、batch review、grace period）
 * - counter_evidence 绑定反方锚点
 */
import { z } from "zod";
import {
  BaseAssetFields,
  IsoDateTimeString,
  NonEmptyString,
  UnitInterval,
  CURRENT_PROTOCOL_VERSION,
} from "../_shared/base.js";
import { AssetLifecycleSchema } from "../_shared/lifecycle.js";

// ─── Enums ────────────────────────────────────────────────────────

export const MemoryTypeSchema = z.enum(["profile", "context", "experience", "policy"]);
export type MemoryType = z.infer<typeof MemoryTypeSchema>;

export const MemorySourceSchema = z.enum(["vault", "import", "agent", "manual", "external_feedback"]);
export type MemorySource = z.infer<typeof MemorySourceSchema>;

export const MemoryScopeSchema = z.enum(["global", "product", "project", "session"]);
export type MemoryScope = z.infer<typeof MemoryScopeSchema>;

// ─── Review Sub-Object ────────────────────────────────────────────

export const ReviewPolicySchema = z.enum(["expiring", "manual", "contradiction-driven"]);

export const ReviewStateSchema = z.enum([
  "scheduled",   // 正常等待下次复审
  "due",         // 进入提醒窗口
  "overdue",     // 超过 grace 期限
  "revalidated", // 刚复审通过
  "downgraded",  // 已被自动降级
  "frozen",      // 被高影响报告冻结
]);

export const ReviewOutcomeSchema = z.enum([
  "confirmed",   // 核心判断仍有效
  "extended",    // 用户确认有效并自定义延期
  "delayed",     // 一键延期 30 天
  "downgraded",  // 到期自动降级
  "frozen",      // 被证伪报告冻结
  "falsified",   // 用户手动标记证伪
]);

export const ReviewGroupFieldSchema = z.enum(["type", "status", "scope", "product"]);

export const MemoryReviewSchema = z.object({
  policy: ReviewPolicySchema,
  next_review_at: IsoDateTimeString,
  reminder_window_days: z.number().int().positive().max(90).default(7),
  grace_days: z.number().int().min(0).max(90).default(14),
  state: ReviewStateSchema,
  last_outcome: ReviewOutcomeSchema.optional(),
  degrade_to: z.literal("hypothesis").default("hypothesis"),
  batch_review_supported: z.literal(true).default(true),
  batch_group_by: z.array(ReviewGroupFieldSchema).min(1).default(["type", "status"]),
  default_valid_days_after_confirmation: z.number().int().positive().max(365).default(180),
  allow_custom_valid_days: z.boolean().default(true),
  metadata_only_review_preserves_expiry: z.boolean().default(true),
  quick_actions: z.array(z.literal("delay_30_days")).default(["delay_30_days"]),
  reviewed_at: IsoDateTimeString.optional(),
  note: z.string().optional(),
});
export type MemoryReview = z.infer<typeof MemoryReviewSchema>;

// ─── Memory Item ──────────────────────────────────────────────────

export const MemoryItemSchema = BaseAssetFields.extend({
  type: MemoryTypeSchema,
  title: NonEmptyString,
  summary: NonEmptyString,
  content: NonEmptyString,
  source: MemorySourceSchema,
  scope: MemoryScopeSchema,
  product: NonEmptyString.optional(),
  tags: z.array(NonEmptyString).default([]),
  status: AssetLifecycleSchema,
  confidence: UnitInterval.default(0.5),
  expires_at: IsoDateTimeString.optional(),
  last_validated_at: IsoDateTimeString.optional(),
  validation_note: z.string().optional(),
  review: MemoryReviewSchema,
  counter_evidence: z.array(NonEmptyString).default([]),
  related_items: z.array(NonEmptyString).default([]),
}).superRefine((mem, ctx) => {
  if (mem.expires_at) {
    if (Date.parse(mem.expires_at) <= Date.parse(mem.created_at)) {
      ctx.addIssue({
        code: "custom",
        path: ["expires_at"],
        message: "expires_at must be later than created_at",
      });
    }
  }
});

export type MemoryItem = z.infer<typeof MemoryItemSchema>;

// ─── Create Input (用户输入的最小集) ──────────────────────────────

export const CreateMemoryInputSchema = z.object({
  type: MemoryTypeSchema,
  title: NonEmptyString,
  summary: NonEmptyString,
  content: NonEmptyString,
  source: MemorySourceSchema.default("manual"),
  scope: MemoryScopeSchema.default("global"),
  product: NonEmptyString.optional(),
  tags: z.array(NonEmptyString).default([]),
  confidence: UnitInterval.default(0.5),
  counter_evidence: z.array(NonEmptyString).default([]),
});

export type CreateMemoryInput = z.infer<typeof CreateMemoryInputSchema>;

// ─── JSON Schema ──────────────────────────────────────────────────

import { buildJsonSchemaDoc, extractRequiredFields } from "../_shared/json-schema.js";

export const MemoryJsonSchema = buildJsonSchemaDoc(MemoryItemSchema, {
  $id: `moonos/protocols/memory/v${CURRENT_PROTOCOL_VERSION}`,
  title: "MoonOS Memory Protocol",
  description: "可迁移、可治理、可证伪的记忆对象。",
});

export const MemoryRequiredFields = extractRequiredFields(MemoryJsonSchema);
