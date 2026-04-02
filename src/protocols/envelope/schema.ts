/**
 * Asset Envelope & Bundle — 导入导出的统一封装格式。
 */
import { z } from "zod";
import { NonEmptyString, IsoDateTimeString, SemverString, Sha256Digest, UnknownRecord, CURRENT_PROTOCOL_VERSION } from "../_shared/base.js";
import { buildJsonSchemaDoc, extractRequiredFields } from "../_shared/json-schema.js";

// ─── Asset Envelope ───────────────────────────────────────────

export const AssetTypeSchema = z.enum(["memory", "skill-contract", "skill-implementation", "workflow", "trace", "external-feedback"]);
export type AssetType = z.infer<typeof AssetTypeSchema>;

export const AssetEnvelopeSchema = z.object({
  asset_id: NonEmptyString,
  asset_type: AssetTypeSchema,
  protocol_version: SemverString,
  schema_id: NonEmptyString,
  hash: Sha256Digest,
  source_system: NonEmptyString,
  exported_at: IsoDateTimeString,
  updated_at: IsoDateTimeString.optional(),
  payload: UnknownRecord,
});
export type AssetEnvelope = z.infer<typeof AssetEnvelopeSchema>;

// ─── Asset Reference ──────────────────────────────────────────

export const AssetReferenceSchema = z.object({
  from: NonEmptyString,
  to: NonEmptyString,
  relation: NonEmptyString,
});
export type AssetReference = z.infer<typeof AssetReferenceSchema>;

// ─── Asset Bundle ─────────────────────────────────────────────

export const BundleTypeSchema = z.enum(["export", "import-preview", "migration-backup", "replay-context"]);

export const AssetBundleSchema = z.object({
  bundle_id: NonEmptyString,
  bundle_version: SemverString,
  created_at: IsoDateTimeString,
  source_system: NonEmptyString,
  bundle_type: BundleTypeSchema,
  manifest: z.object({
    protocol_catalog_version: SemverString,
    asset_counts: z.record(NonEmptyString, z.number().int().nonnegative()),
    dependencies: z.array(NonEmptyString).default([]),
  }),
  assets: z.array(AssetEnvelopeSchema).default([]),
  references: z.array(AssetReferenceSchema).default([]),
});
export type AssetBundle = z.infer<typeof AssetBundleSchema>;

// ─── JSON Schema ──────────────────────────────────────────────

export const AssetEnvelopeJsonSchema = buildJsonSchemaDoc(AssetEnvelopeSchema, {
  $id: `moonos/supporting/asset-envelope/v${CURRENT_PROTOCOL_VERSION}`,
  title: "MoonOS Asset Envelope",
  description: "统一封装导入导出资产的最小外壳。",
});
export const AssetEnvelopeRequiredFields = extractRequiredFields(AssetEnvelopeJsonSchema);

export const AssetBundleJsonSchema = buildJsonSchemaDoc(AssetBundleSchema, {
  $id: `moonos/supporting/asset-bundle/v${CURRENT_PROTOCOL_VERSION}`,
  title: "MoonOS Asset Bundle",
  description: "统一表达 import / export / migration backup 的资产包格式。",
});
export const AssetBundleRequiredFields = extractRequiredFields(AssetBundleJsonSchema);
