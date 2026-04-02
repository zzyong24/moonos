/**
 * StorageAdapter — 存储抽象接口。
 * MVP 只实现文件存储，但接口设计允许后续替换为 SQLite / Vault。
 */

export interface QueryFilter {
  /** 按字段精确匹配 */
  where?: Record<string, unknown>;
  /** 按标签包含 */
  tags?: string[];
  /** expires_at 早于此时间 */
  expires_before?: string;
  /** 分页 */
  limit?: number;
  offset?: number;
  /** 排序 */
  sort_by?: string;
  sort_order?: "asc" | "desc";
}

export interface WorkspaceStats {
  collections: Record<string, { count: number; lastModified: string | null }>;
  totalFiles: number;
  version: string;
}

export interface StorageAdapter {
  /** 初始化存储（创建目录结构等） */
  initialize(): Promise<void>;

  /** 检查存储是否已初始化 */
  isInitialized(): Promise<boolean>;

  /** 获取工作区统计 */
  getStats(): Promise<WorkspaceStats>;

  /** 获取单条记录 */
  get<T>(collection: string, id: string): Promise<T | null>;

  /** 列出记录 */
  list<T>(collection: string, filter?: QueryFilter): Promise<T[]>;

  /** 创建记录 */
  create<T extends { id: string }>(collection: string, item: T): Promise<T>;

  /** 更新记录（全量替换） */
  update<T extends { id: string }>(collection: string, id: string, item: T): Promise<T>;

  /** 部分更新 */
  patch<T extends { id: string }>(collection: string, id: string, patch: Partial<T>): Promise<T>;

  /** 删除记录 */
  delete(collection: string, id: string): Promise<boolean>;

  /** 计数 */
  count(collection: string, filter?: QueryFilter): Promise<number>;
}
