/**
 * 5 种冲突解决策略定义。
 */
import { z } from "zod";
import { NonEmptyString, IsoDateTimeString } from "../_shared/base.js";

export const ConflictResolutionPolicySchema = z.enum([
  "user_confirm",  // 默认：逐条让用户确认
  "overwrite",     // 覆盖已有（高风险，需二次确认）
  "keep_both",     // 保留双版本
  "skip",          // 跳过冲突资产
  "newer_first",   // 按 updated_at 优先选新的
]);
export type ConflictResolutionPolicy = z.infer<typeof ConflictResolutionPolicySchema>;

/** 字段级冲突描述 */
export const FieldConflictSchema = z.object({
  asset_id: NonEmptyString,
  asset_type: NonEmptyString,
  field_path: NonEmptyString,
  existing_value: z.unknown(),
  incoming_value: z.unknown(),
  updated_at_existing: IsoDateTimeString.optional(),
  updated_at_incoming: IsoDateTimeString.optional(),
});
export type FieldConflict = z.infer<typeof FieldConflictSchema>;
