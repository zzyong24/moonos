/**
 * Zod → JSON Schema 工具函数。
 * 单一来源：所有 JSON Schema 都从 Zod schema 自动生成，不手写。
 */
import type { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const JSON_SCHEMA_DRAFT = "https://json-schema.org/draft/2020-12/schema";

export interface JsonSchemaDocument {
  $schema: string;
  $id: string;
  title: string;
  description?: string;
  [key: string]: unknown;
}

export function buildJsonSchemaDoc(
  schema: z.ZodTypeAny,
  meta: { $id: string; title: string; description: string },
): JsonSchemaDocument {
  const generated = zodToJsonSchema(schema, {
    name: meta.title,
    target: "jsonSchema2019-09",
  }) as Record<string, unknown>;

  // 从 definitions wrapper 中提取主 schema
  const definitions = generated.definitions as Record<string, unknown> | undefined;
  const mainSchema = definitions?.[meta.title] as Record<string, unknown> | undefined;
  const base = mainSchema ?? generated;

  return {
    ...base,
    $schema: JSON_SCHEMA_DRAFT,
    $id: meta.$id,
    title: meta.title,
    description: meta.description,
  };
}

/** 从 JSON Schema 中提取 required 字段列表 */
export function extractRequiredFields(schema: JsonSchemaDocument): string[] {
  const required = schema.required;
  if (!Array.isArray(required)) return [];
  return required.filter((f): f is string => typeof f === "string");
}
