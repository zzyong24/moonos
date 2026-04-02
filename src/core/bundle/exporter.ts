/**
 * Bundle Exporter — 将工作区中的资产导出为 AssetBundle JSON 文件。
 */
import { createHash } from "node:crypto";
import { nanoid } from "nanoid";
import type { StorageAdapter } from "../../storage/interface.js";
import { COLLECTIONS } from "../../storage/file/layout.js";
import { CURRENT_PROTOCOL_VERSION } from "../../protocols/_shared/base.js";
import type { AssetBundle, AssetEnvelope, AssetType } from "../../protocols/envelope/schema.js";
import { AssetBundleSchema } from "../../protocols/envelope/schema.js";

/** collection 名到 AssetType 的映射 */
const COLLECTION_TO_ASSET_TYPE: Record<string, AssetType> = {
  memory: "memory",
  skill: "skill-contract",
  workflow: "workflow",
  trace: "trace",
  feedback: "external-feedback",
};

function computeHash(payload: unknown): string {
  const hash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  return `sha256:${hash}`;
}

export interface ExportOptions {
  /** 只导出指定 collection */
  collections?: string[];
  /** 来源系统标识 */
  sourceSystem?: string;
}

export async function exportBundle(
  storage: StorageAdapter,
  options: ExportOptions = {},
): Promise<AssetBundle> {
  const collections = options.collections ?? [...COLLECTIONS].filter((c) => c !== "bundles");
  const sourceSystem = options.sourceSystem ?? "moonos";
  const nowStr = new Date().toISOString();
  const assetCounts: Record<string, number> = {};
  const assets: AssetEnvelope[] = [];

  for (const col of collections) {
    const assetType = COLLECTION_TO_ASSET_TYPE[col];
    if (!assetType) continue;

    const items = await storage.list<Record<string, unknown>>(col);
    assetCounts[col] = items.length;

    for (const item of items) {
      const id = item.id as string;
      assets.push({
        asset_id: id,
        asset_type: assetType,
        protocol_version: CURRENT_PROTOCOL_VERSION,
        schema_id: `moonos/protocols/${assetType}/v${CURRENT_PROTOCOL_VERSION}`,
        hash: computeHash(item),
        source_system: sourceSystem,
        exported_at: nowStr,
        updated_at: (item.updated_at as string) ?? nowStr,
        payload: item,
      });
    }
  }

  const bundle: AssetBundle = AssetBundleSchema.parse({
    bundle_id: `bundle_${nanoid(12)}`,
    bundle_version: "0.1.0",
    created_at: nowStr,
    source_system: sourceSystem,
    bundle_type: "export",
    manifest: {
      protocol_catalog_version: CURRENT_PROTOCOL_VERSION,
      asset_counts: assetCounts,
      dependencies: [],
    },
    assets,
    references: [],
  });

  return bundle;
}
