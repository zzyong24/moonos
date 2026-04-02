/**
 * Operation Record / Import Record — 导入导出操作的审计记录。
 */
import { z } from "zod";
import { NonEmptyString, IsoDateTimeString, CURRENT_PROTOCOL_VERSION } from "../_shared/base.js";
import { ConflictResolutionPolicySchema, FieldConflictSchema } from "../envelope/conflict.js";
import { buildJsonSchemaDoc, extractRequiredFields } from "../_shared/json-schema.js";

export const OperationTypeSchema = z.enum(["import", "export", "replay", "migrate"]);
export const OperationStatusSchema = z.enum(["planned", "validated", "awaiting_confirmation", "running", "completed", "failed", "rolled_back"]);

const OperationValidationSchema = z.object({
  schema_passed: z.boolean(),
  hash_verified: z.boolean(),
  asset_conflicts: z.array(NonEmptyString).default([]),
  field_conflicts: z.array(FieldConflictSchema).default([]),
});

const OperationResultSchema = z.object({
  changed_assets: z.number().int().nonnegative().default(0),
  skipped_assets: z.number().int().nonnegative().default(0),
  failed_assets: z.array(NonEmptyString).default([]),
  note: z.string().optional(),
});

export const OperationRecordSchema = z.object({
  operation_id: NonEmptyString,
  operation_type: OperationTypeSchema,
  status: OperationStatusSchema,
  created_at: IsoDateTimeString,
  source_system: NonEmptyString,
  target_system: NonEmptyString,
  bundle_id: NonEmptyString.optional(),
  summary: NonEmptyString,
  validation: OperationValidationSchema,
  conflict_resolution_policy: ConflictResolutionPolicySchema.default("user_confirm"),
  secondary_confirmation_required: z.boolean().default(false),
  result: OperationResultSchema,
});
export type OperationRecord = z.infer<typeof OperationRecordSchema>;

export const ImportRecordSchema = OperationRecordSchema.extend({
  operation_type: z.literal("import"),
  import_policy: z.object({
    default_conflict_resolution_policy: z.literal("user_confirm").default("user_confirm"),
    overwrite_requires_second_confirmation: z.literal(true).default(true),
    field_level_conflict_detection: z.literal(true).default(true),
    keep_both_suffix_format: z.string().default("copy-{timestamp}"),
  }),
});
export type ImportRecord = z.infer<typeof ImportRecordSchema>;

// ─── JSON Schema ──────────────────────────────────────────────

export const OperationRecordJsonSchema = buildJsonSchemaDoc(OperationRecordSchema, {
  $id: `moonos/supporting/operation-record/v${CURRENT_PROTOCOL_VERSION}`,
  title: "MoonOS Operation Record",
  description: "统一记录 import / export / replay / migrate 的校验、冲突和结果。",
});
export const OperationRecordRequiredFields = extractRequiredFields(OperationRecordJsonSchema);
