/**
 * Bundle Importer — 读取 AssetBundle，检测冲突，执行导入。
 *
 * 导入流程：
 * 1. 解析 bundle JSON → Zod 校验
 * 2. 检测冲突（逐条比对已有资产，生成字段级 diff）
 * 3. 根据 policy 决定处理方式
 * 4. 执行导入（create / update / skip）
 * 5. 返回 ImportResult（含 OperationRecord 审计信息）
 */
import { createHash } from "node:crypto";
import { nanoid } from "nanoid";
import type { StorageAdapter } from "../../storage/interface.js";
import { AssetBundleSchema } from "../../protocols/envelope/schema.js";
import type { AssetBundle, AssetEnvelope } from "../../protocols/envelope/schema.js";
import type { ConflictResolutionPolicy, FieldConflict } from "../../protocols/envelope/conflict.js";

// ─── Asset type → collection 映射 ─────────────────────────────

const ASSET_TYPE_TO_COLLECTION: Record<string, string> = {
  "memory": "memory",
  "skill-contract": "skill",
  "skill-implementation": "skill",
  "workflow": "workflow",
  "trace": "trace",
  "external-feedback": "feedback",
};

// ─── Types ────────────────────────────────────────────────────

export interface ImportConflict {
  asset_id: string;
  asset_type: string;
  field_conflicts: FieldConflict[];
}

export interface ImportResult {
  operation_id: string;
  status: "completed" | "completed_with_conflicts" | "failed";
  total: number;
  imported: number;
  skipped: number;
  overwritten: number;
  conflicts: ImportConflict[];
  errors: string[];
}

export interface ImportOptions {
  policy?: ConflictResolutionPolicy;
}

// ─── Parse Bundle ─────────────────────────────────────────────

export function parseBundle(json: unknown): AssetBundle {
  return AssetBundleSchema.parse(json);
}

// ─── Detect Conflicts ─────────────────────────────────────────

function detectFieldConflicts(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
  assetId: string,
  assetType: string,
): FieldConflict[] {
  const conflicts: FieldConflict[] = [];
  // 只比较非元数据字段
  const skipFields = new Set(["id", "created_at", "updated_at"]);

  for (const key of Object.keys(incoming)) {
    if (skipFields.has(key)) continue;
    const existingVal = existing[key];
    const incomingVal = incoming[key];

    if (JSON.stringify(existingVal) !== JSON.stringify(incomingVal)) {
      conflicts.push({
        asset_id: assetId,
        asset_type: assetType,
        field_path: key,
        existing_value: existingVal,
        incoming_value: incomingVal,
        updated_at_existing: existing.updated_at as string | undefined,
        updated_at_incoming: incoming.updated_at as string | undefined,
      });
    }
  }

  return conflicts;
}

// ─── Import ───────────────────────────────────────────────────

export async function importBundle(
  storage: StorageAdapter,
  bundle: AssetBundle,
  options: ImportOptions = {},
): Promise<ImportResult> {
  const policy = options.policy ?? "user_confirm";
  const result: ImportResult = {
    operation_id: `op_import_${nanoid(12)}`,
    status: "completed",
    total: bundle.assets.length,
    imported: 0,
    skipped: 0,
    overwritten: 0,
    conflicts: [],
    errors: [],
  };

  for (const envelope of bundle.assets) {
    const collection = ASSET_TYPE_TO_COLLECTION[envelope.asset_type];
    if (!collection) {
      result.errors.push(`Unknown asset type: ${envelope.asset_type} (${envelope.asset_id})`);
      continue;
    }

    try {
      const existing = await storage.get<Record<string, unknown>>(collection, envelope.asset_id);
      const payload = envelope.payload as Record<string, unknown> & { id: string };

      if (!existing) {
        // 不存在 → 直接创建
        await storage.create(collection, { ...payload, id: envelope.asset_id });
        result.imported++;
        continue;
      }

      // 存在 → 检测冲突
      const fieldConflicts = detectFieldConflicts(existing, payload, envelope.asset_id, envelope.asset_type);

      if (fieldConflicts.length === 0) {
        // 无冲突 → 直接更新
        await storage.update(collection, envelope.asset_id, { ...payload, id: envelope.asset_id });
        result.imported++;
        continue;
      }

      // 有冲突 → 按策略处理
      result.conflicts.push({
        asset_id: envelope.asset_id,
        asset_type: envelope.asset_type,
        field_conflicts: fieldConflicts,
      });

      switch (policy) {
        case "overwrite": {
          await storage.update(collection, envelope.asset_id, { ...payload, id: envelope.asset_id });
          result.overwritten++;
          break;
        }
        case "skip": {
          result.skipped++;
          break;
        }
        case "newer_first": {
          const existingTime = existing.updated_at as string | undefined;
          const incomingTime = payload.updated_at as string | undefined;
          if (incomingTime && existingTime && incomingTime > existingTime) {
            await storage.update(collection, envelope.asset_id, { ...payload, id: envelope.asset_id });
            result.overwritten++;
          } else {
            result.skipped++;
          }
          break;
        }
        case "keep_both": {
          // 用不同 ID 创建副本
          const copyId = `${envelope.asset_id}_copy_${Date.now()}`;
          await storage.create(collection, { ...payload, id: copyId });
          result.imported++;
          break;
        }
        case "user_confirm":
        default: {
          // user_confirm 模式下，有冲突的资产跳过，让用户后续处理
          result.skipped++;
          break;
        }
      }
    } catch (err) {
      result.errors.push(`Failed to import ${envelope.asset_id}: ${(err as Error).message}`);
    }
  }

  if (result.conflicts.length > 0) {
    result.status = "completed_with_conflicts";
  }
  if (result.errors.length > 0 && result.imported === 0) {
    result.status = "failed";
  }

  return result;
}
