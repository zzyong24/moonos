/**
 * CLI 工具函数 — resolveWorkspace、错误处理、输出格式化。
 */
import { resolveWorkspace as coreResolveWorkspace } from "../core/workspace.js";
import type { Workspace } from "../core/workspace.js";
import { formatCliError, t } from "./i18n.js";

/** 解析工作区，失败时输出友好错误并退出 */
export async function resolveWorkspaceOrExit(): Promise<Workspace> {
  try {
    return await coreResolveWorkspace();
  } catch (err) {
    console.error(`${t("common.errorPrefix")}: ${formatCliError(err)}`);
    process.exit(1);
  }
}

/** 统一错误处理包装 */
export function handleError(err: unknown): never {
  console.error(`${t("common.errorPrefix")}: ${formatCliError(err)}`);
  process.exit(1);
}
