/**
 * MoonOS Protocol Catalog — 组装所有协议定义 + 版本兼容工具。
 */
import { CURRENT_PROTOCOL_VERSION } from "./_shared/base.js";
import type { JsonSchemaDocument } from "./_shared/json-schema.js";
import { extractRequiredFields } from "./_shared/json-schema.js";

import { MemoryJsonSchema } from "./memory/schema.js";
import { SkillContractJsonSchema, SkillImplementationJsonSchema } from "./skill/schema.js";
import { WorkflowJsonSchema } from "./workflow/schema.js";
import { TraceJsonSchema, ParamResolvedJsonSchema } from "./trace/schema.js";
import { FeedbackJsonSchema } from "./feedback/schema.js";
import { AssetEnvelopeJsonSchema, AssetBundleJsonSchema } from "./envelope/schema.js";
import { OperationRecordJsonSchema } from "./operations/schema.js";

export interface ProtocolEntry {
  id: string;
  name: string;
  version: string;
  description: string;
  requiredFields: string[];
  schema: JsonSchemaDocument;
}

export const PROTOCOL_CATALOG: ProtocolEntry[] = [
  { id: "memory", name: "Memory Protocol", version: CURRENT_PROTOCOL_VERSION, description: "可迁移、可治理、可证伪的记忆对象。", requiredFields: extractRequiredFields(MemoryJsonSchema), schema: MemoryJsonSchema },
  { id: "skill-contract", name: "Skill Contract", version: CURRENT_PROTOCOL_VERSION, description: "稳定的能力契约层。", requiredFields: extractRequiredFields(SkillContractJsonSchema), schema: SkillContractJsonSchema },
  { id: "skill-implementation", name: "Skill Implementation", version: CURRENT_PROTOCOL_VERSION, description: "面向具体平台的技能实现层。", requiredFields: extractRequiredFields(SkillImplementationJsonSchema), schema: SkillImplementationJsonSchema },
  { id: "workflow", name: "Workflow Protocol", version: CURRENT_PROTOCOL_VERSION, description: "exploit/explore/chaos 三类可迁移工作流。", requiredFields: extractRequiredFields(WorkflowJsonSchema), schema: WorkflowJsonSchema },
  { id: "trace", name: "Trace Protocol", version: CURRENT_PROTOCOL_VERSION, description: "最小可观测、可复现的执行痕迹。", requiredFields: extractRequiredFields(TraceJsonSchema), schema: TraceJsonSchema },
  { id: "external-feedback", name: "External Feedback Protocol", version: CURRENT_PROTOCOL_VERSION, description: "外部反馈结构化回流。", requiredFields: extractRequiredFields(FeedbackJsonSchema), schema: FeedbackJsonSchema },
];

export const SUPPORTING_OBJECT_CATALOG: ProtocolEntry[] = [
  { id: "asset-envelope", name: "Asset Envelope", version: CURRENT_PROTOCOL_VERSION, description: "资产导入导出封装。", requiredFields: extractRequiredFields(AssetEnvelopeJsonSchema), schema: AssetEnvelopeJsonSchema },
  { id: "asset-bundle", name: "Asset Bundle", version: CURRENT_PROTOCOL_VERSION, description: "资产包格式。", requiredFields: extractRequiredFields(AssetBundleJsonSchema), schema: AssetBundleJsonSchema },
  { id: "operation-record", name: "Operation Record", version: CURRENT_PROTOCOL_VERSION, description: "操作审计记录。", requiredFields: extractRequiredFields(OperationRecordJsonSchema), schema: OperationRecordJsonSchema },
  { id: "param-resolved-payload", name: "Param Resolved Payload", version: CURRENT_PROTOCOL_VERSION, description: "resolver 核心复现数据。", requiredFields: extractRequiredFields(ParamResolvedJsonSchema), schema: ParamResolvedJsonSchema },
];

export const FULL_CATALOG = [...PROTOCOL_CATALOG, ...SUPPORTING_OBJECT_CATALOG];

export function getCatalogEntry(id: string): ProtocolEntry | undefined {
  return FULL_CATALOG.find((e) => e.id === id);
}

export function getCatalogEntryIds(): string[] {
  return FULL_CATALOG.map((e) => e.id);
}
