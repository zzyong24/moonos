/**
 * Workspace — 工作区管理。
 * 负责 init、status、resolveWorkspace（向上查找 .moonos/）。
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { MoonOSError } from "./errors.js";
import { FileStorageAdapter } from "../storage/file/adapter.js";
import { WORKSPACE_DIR } from "../storage/file/layout.js";
import type { StorageAdapter, WorkspaceStats } from "../storage/interface.js";

export interface Workspace {
  /** 包含 .moonos/ 的父目录 */
  rootPath: string;
  storage: StorageAdapter;
}

/** 初始化新工作区 */
export async function initWorkspace(targetDir: string): Promise<Workspace> {
  const storage = new FileStorageAdapter(targetDir);
  await storage.initialize();
  return { rootPath: targetDir, storage };
}

/** 获取工作区状态 */
export async function getWorkspaceStatus(workspace: Workspace): Promise<WorkspaceStats> {
  return workspace.storage.getStats();
}

/**
 * 从 startDir 向上查找 .moonos/ 目录，返回 Workspace。
 * 类似 git 查找 .git/ 的逻辑。
 */
export async function resolveWorkspace(startDir: string = process.cwd()): Promise<Workspace> {
  let current = path.resolve(startDir);

  while (true) {
    const candidate = path.join(current, WORKSPACE_DIR);
    try {
      const stat = await fs.stat(candidate);
      if (stat.isDirectory()) {
        const storage = new FileStorageAdapter(current);
        if (await storage.isInitialized()) {
          return { rootPath: current, storage };
        }
      }
    } catch {
      // 目录不存在，继续向上
    }

    const parent = path.dirname(current);
    if (parent === current) {
      throw new MoonOSError(
        "error.workspace.notFound",
        "MoonOS workspace not found (.moonos/ directory).\nRun `moonos init` first.",
      );
    }
    current = parent;
  }
}
