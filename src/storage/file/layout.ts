/** .moonos/ 目录布局常量 */

export const WORKSPACE_DIR = ".moonos";
export const CONFIG_FILE = "config.json";

/** 所有支持的 collection 名 */
export const COLLECTIONS = [
  "memory",
  "skill",
  "workflow",
  "trace",
  "feedback",
  "bundles",
] as const;

export type CollectionName = (typeof COLLECTIONS)[number];

/** 每个 collection 的 index 文件名 */
export const INDEX_FILE = "index.json";

/** 报告子目录 */
export const REPORTS_DIR = "reports";
export const FALSIFICATION_DIR = "falsification";
