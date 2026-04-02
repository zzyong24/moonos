/**
 * Skill Protocol v0.3 — Contract + Implementation 双层模型。
 *
 * Skill Contract 是稳定的能力契约，不与具体平台绑死。
 * Skill Implementation 是面向特定平台/模型的具体实现。
 */
import { z } from "zod";
import { NonEmptyString, SemverString, StringMap, CURRENT_PROTOCOL_VERSION } from "../_shared/base.js";
import { buildJsonSchemaDoc, extractRequiredFields } from "../_shared/json-schema.js";

// ─── Skill Contract ───────────────────────────────────────────

const SkillOutputContractSchema = z.object({
  type: NonEmptyString,
  sections: z.array(NonEmptyString).min(1),
});

const SkillEvaluationSchema = z.object({
  must_include: z.array(NonEmptyString).min(1),
  anti_patterns: z.array(NonEmptyString).default([]),
});

export const SkillContractSchema = z.object({
  id: NonEmptyString,
  name: NonEmptyString,
  description: NonEmptyString,
  category: NonEmptyString,
  triggers: z.array(NonEmptyString).default([]),
  input_contract: StringMap,
  output_contract: SkillOutputContractSchema,
  constraints: z.array(NonEmptyString).min(1),
  evaluation: SkillEvaluationSchema,
  version: SemverString,
});
export type SkillContract = z.infer<typeof SkillContractSchema>;

// ─── Skill Implementation ─────────────────────────────────────

const SkillPromptSchema = z.object({ name: NonEmptyString, path: NonEmptyString });
const SkillToolBindingSchema = z.object({ name: NonEmptyString, required: z.boolean().default(false) });
const RuntimeApprovalSchema = z.enum(["never", "optional", "required"]);

export const SkillImplementationSchema = z.object({
  id: NonEmptyString,
  contract_id: NonEmptyString,
  target: NonEmptyString,
  prompts: z.array(SkillPromptSchema).default([]),
  tools: z.array(SkillToolBindingSchema).default([]),
  runtime_policy: z.object({
    approval: RuntimeApprovalSchema.default("optional"),
    max_tool_calls: z.number().int().positive().max(32),
  }),
  compatibility: z.object({
    version: SemverString,
    adapter: NonEmptyString,
  }),
});
export type SkillImplementation = z.infer<typeof SkillImplementationSchema>;

// ─── JSON Schema ──────────────────────────────────────────────

export const SkillContractJsonSchema = buildJsonSchemaDoc(SkillContractSchema, {
  $id: `moonos/protocols/skill-contract/v${CURRENT_PROTOCOL_VERSION}`,
  title: "MoonOS Skill Contract",
  description: "稳定的能力契约层，不与具体平台实现绑死。",
});
export const SkillContractRequiredFields = extractRequiredFields(SkillContractJsonSchema);

export const SkillImplementationJsonSchema = buildJsonSchemaDoc(SkillImplementationSchema, {
  $id: `moonos/protocols/skill-implementation/v${CURRENT_PROTOCOL_VERSION}`,
  title: "MoonOS Skill Implementation",
  description: "面向具体模型、工具集和平台的技能实现层。",
});
export const SkillImplementationRequiredFields = extractRequiredFields(SkillImplementationJsonSchema);
