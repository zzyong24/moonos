/**
 * FileStorageAdapter — 基于 JSON 文件的本地存储实现。
 *
 * 存储结构：
 *   .moonos/{collection}/index.json  — 轻量索引（快速 list）
 *   .moonos/{collection}/{id}.json   — 单条完整数据
 *
 * 写入使用原子操作（写 .tmp → rename），防止中途崩溃导致数据损坏。
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { MoonOSError } from "../../core/errors.js";
import type { StorageAdapter, QueryFilter, WorkspaceStats } from "../interface.js";
import { WORKSPACE_DIR, CONFIG_FILE, COLLECTIONS, INDEX_FILE, REPORTS_DIR, FALSIFICATION_DIR } from "./layout.js";
import { CURRENT_PROTOCOL_VERSION } from "../../protocols/_shared/base.js";

interface IndexEntry {
  id: string;
  updated_at: string;
  [key: string]: unknown;
}

export class FileStorageAdapter implements StorageAdapter {
  private basePath: string;

  constructor(workspacePath: string) {
    this.basePath = path.join(workspacePath, WORKSPACE_DIR);
  }

  get rootPath(): string {
    return this.basePath;
  }

  // ─── Lifecycle ───────────────────────────────────────────────

  async initialize(): Promise<void> {
    // 创建主目录
    await fs.mkdir(this.basePath, { recursive: true });

    // 创建所有 collection 目录 + 空 index
    for (const col of COLLECTIONS) {
      const colDir = path.join(this.basePath, col);
      await fs.mkdir(colDir, { recursive: true });
      const indexPath = path.join(colDir, INDEX_FILE);
      if (!(await this.fileExists(indexPath))) {
        await this.writeAtomic(indexPath, "[]");
      }
    }

    // 创建报告目录
    await fs.mkdir(path.join(this.basePath, REPORTS_DIR, FALSIFICATION_DIR), { recursive: true });

    // 写入 config
    const configPath = path.join(this.basePath, CONFIG_FILE);
    if (!(await this.fileExists(configPath))) {
      const config = {
        version: CURRENT_PROTOCOL_VERSION,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await this.writeAtomic(configPath, JSON.stringify(config, null, 2));
    }
  }

  async isInitialized(): Promise<boolean> {
    return this.fileExists(path.join(this.basePath, CONFIG_FILE));
  }

  async getStats(): Promise<WorkspaceStats> {
    const collections: WorkspaceStats["collections"] = {};
    let totalFiles = 0;

    for (const col of COLLECTIONS) {
      const index = await this.readIndex(col);
      const lastModified = index.length > 0
        ? index.reduce((latest, e) => (e.updated_at > latest ? e.updated_at : latest), index[0].updated_at)
        : null;
      collections[col] = { count: index.length, lastModified };
      totalFiles += index.length;
    }

    const config = await this.readConfig();
    return { collections, totalFiles, version: config?.version ?? CURRENT_PROTOCOL_VERSION };
  }

  // ─── CRUD ───────────────────────────────────────────────────

  async get<T>(collection: string, id: string): Promise<T | null> {
    const filePath = this.itemPath(collection, id);
    if (!(await this.fileExists(filePath))) return null;
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content) as T;
  }

  async list<T>(collection: string, filter?: QueryFilter): Promise<T[]> {
    const index = await this.readIndex(collection);
    let entries = index;

    // 简单 where 过滤（在 index 级）
    if (filter?.where) {
      for (const [key, value] of Object.entries(filter.where)) {
        entries = entries.filter((e) => e[key] === value);
      }
    }

    // expires_before 过滤
    if (filter?.expires_before) {
      const threshold = filter.expires_before;
      entries = entries.filter((e) => {
        const expiresAt = e.expires_at as string | undefined;
        return expiresAt && expiresAt < threshold;
      });
    }

    // 排序
    if (filter?.sort_by) {
      const field = filter.sort_by;
      const order = filter.sort_order === "desc" ? -1 : 1;
      entries.sort((a, b) => {
        const va = String(a[field] ?? "");
        const vb = String(b[field] ?? "");
        return va.localeCompare(vb) * order;
      });
    }

    // 分页
    const offset = filter?.offset ?? 0;
    const limit = filter?.limit ?? entries.length;
    entries = entries.slice(offset, offset + limit);

    // 读取完整数据
    const results: T[] = [];
    for (const entry of entries) {
      const item = await this.get<T>(collection, entry.id);
      if (item) results.push(item);
    }

    return results;
  }

  async create<T extends { id: string }>(collection: string, item: T): Promise<T> {
    const filePath = this.itemPath(collection, item.id);

    if (await this.fileExists(filePath)) {
      throw new MoonOSError(
        "error.storage.itemAlreadyExists",
        `Item already exists: ${collection}/${item.id}`,
        { collection, id: item.id },
      );
    }

    await this.writeAtomic(filePath, JSON.stringify(item, null, 2));

    const index = await this.readIndex(collection);
    index.push(this.toIndexEntry(item));
    await this.writeIndex(collection, index);

    return item;
  }

  async update<T extends { id: string }>(collection: string, id: string, item: T): Promise<T> {
    const filePath = this.itemPath(collection, id);
    if (!(await this.fileExists(filePath))) {
      throw new MoonOSError(
        "error.storage.itemNotFound",
        `Item not found: ${collection}/${id}`,
        { collection, id },
      );
    }

    await this.writeAtomic(filePath, JSON.stringify(item, null, 2));

    const index = await this.readIndex(collection);
    const idx = index.findIndex((e) => e.id === id);
    if (idx >= 0) {
      index[idx] = this.toIndexEntry(item);
    } else {
      index.push(this.toIndexEntry(item));
    }
    await this.writeIndex(collection, index);

    return item;
  }

  async patch<T extends { id: string }>(collection: string, id: string, patchData: Partial<T>): Promise<T> {
    const existing = await this.get<T>(collection, id);
    if (!existing) {
      throw new MoonOSError(
        "error.storage.itemNotFound",
        `Item not found: ${collection}/${id}`,
        { collection, id },
      );
    }
    const merged = { ...existing, ...patchData } as T;
    return this.update(collection, id, merged);
  }

  async delete(collection: string, id: string): Promise<boolean> {
    const filePath = this.itemPath(collection, id);
    if (!(await this.fileExists(filePath))) return false;

    await fs.unlink(filePath);

    // 从 index 移除
    const index = await this.readIndex(collection);
    const filtered = index.filter((e) => e.id !== id);
    await this.writeIndex(collection, filtered);

    return true;
  }

  async count(collection: string, filter?: QueryFilter): Promise<number> {
    if (!filter) {
      const index = await this.readIndex(collection);
      return index.length;
    }
    const items = await this.list(collection, filter);
    return items.length;
  }

  // ─── Internal Helpers ────────────────────────────────────────

  private itemPath(collection: string, id: string): string {
    return path.join(this.basePath, collection, `${id}.json`);
  }

  private async readIndex(collection: string): Promise<IndexEntry[]> {
    const indexPath = path.join(this.basePath, collection, INDEX_FILE);
    if (!(await this.fileExists(indexPath))) return [];
    const content = await fs.readFile(indexPath, "utf-8");
    return JSON.parse(content) as IndexEntry[];
  }

  private async writeIndex(collection: string, index: IndexEntry[]): Promise<void> {
    const indexPath = path.join(this.basePath, collection, INDEX_FILE);
    await this.writeAtomic(indexPath, JSON.stringify(index, null, 2));
  }

  private toIndexEntry(item: Record<string, unknown>): IndexEntry {
    return {
      id: item.id as string,
      updated_at: (item.updated_at as string) ?? new Date().toISOString(),
      // 额外索引字段（用于 list 时快速过滤）
      ...(item.status !== undefined && { status: item.status }),
      ...(item.type !== undefined && { type: item.type }),
      ...(item.scope !== undefined && { scope: item.scope }),
      ...(item.expires_at !== undefined && { expires_at: item.expires_at }),
    };
  }

  private async readConfig(): Promise<Record<string, string> | null> {
    const configPath = path.join(this.basePath, CONFIG_FILE);
    if (!(await this.fileExists(configPath))) return null;
    const content = await fs.readFile(configPath, "utf-8");
    return JSON.parse(content);
  }

  /** 原子写入：先写 .tmp 再 rename */
  private async writeAtomic(target: string, content: string): Promise<void> {
    const dir = path.dirname(target);
    await fs.mkdir(dir, { recursive: true });
    const tmp = `${target}.tmp`;
    await fs.writeFile(tmp, content, "utf-8");
    await fs.rename(tmp, target);
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
