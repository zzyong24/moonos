/**
 * WorkflowService — Workflow 的 CRUD + 从外部加载。
 *
 * MoonOS 是框架，不内置任何业务工作流。
 * 工作流数据从外部注入：
 *   - CLI: `moonos workflow load ./my-workflows/`
 *   - API: WorkflowService.load(data)
 *   - Bundle: import 时自动写入 workflow collection
 *
 * 存储在 .moonos/workflow/{id}.json，跟 memory、skill 平级。
 */
import { nanoid } from "nanoid";
import type { StorageAdapter } from "../../storage/interface.js";
import { WorkflowProtocolSchema } from "../../protocols/workflow/schema.js";
import type { WorkflowProtocol } from "../../protocols/workflow/schema.js";
import { CURRENT_PROTOCOL_VERSION } from "../../protocols/_shared/base.js";

const COLLECTION = "workflow";

export interface WorkflowSummary {
  id: string;
  name: string;
  workflow_class: string;
  node_count: number;
  version: string;
}

export interface LoadResult {
  loaded: number;
  skipped: number;
  errors: Array<{ id?: string; reason: string }>;
}

export class WorkflowService {
  constructor(private storage: StorageAdapter) {}

  // ─── CRUD ─────────────────────────────────────────────────

  async create(input: Omit<WorkflowProtocol, "version"> & { version?: string }): Promise<WorkflowProtocol> {
    const workflow = WorkflowProtocolSchema.parse({
      ...input,
      id: input.id ?? `wf_${nanoid(10)}`,
      version: input.version ?? CURRENT_PROTOCOL_VERSION,
    });

    await this.storage.create(COLLECTION, {
      ...workflow,
      id: workflow.id,
      updated_at: new Date().toISOString(),
    });
    return workflow;
  }

  async get(id: string): Promise<WorkflowProtocol | null> {
    return this.storage.get<WorkflowProtocol>(COLLECTION, id);
  }

  async list(): Promise<WorkflowProtocol[]> {
    return this.storage.list<WorkflowProtocol>(COLLECTION, {
      sort_by: "updated_at",
      sort_order: "desc",
    });
  }

  async listSummaries(): Promise<WorkflowSummary[]> {
    const all = await this.list();
    return all.map((w) => ({
      id: w.id,
      name: w.name,
      workflow_class: w.workflow_class,
      node_count: w.nodes.length,
      version: w.version,
    }));
  }

  async update(id: string, patch: Partial<WorkflowProtocol>): Promise<WorkflowProtocol> {
    const existing = await this.get(id);
    if (!existing) {
      throw new Error(`Workflow not found: ${id}`);
    }
    const merged = WorkflowProtocolSchema.parse({ ...existing, ...patch });
    await this.storage.update(COLLECTION, id, {
      ...merged,
      id,
      updated_at: new Date().toISOString(),
    });
    return merged;
  }

  async delete(id: string): Promise<boolean> {
    return this.storage.delete(COLLECTION, id);
  }

  async count(): Promise<number> {
    return this.storage.count(COLLECTION);
  }

  // ─── Load ─────────────────────────────────────────────────

  /**
   * 从外部数据批量加载工作流。
   * 每条数据经过 WorkflowProtocolSchema 校验，合格才写入。
   * 已存在的 id 跳过（不覆盖），需要更新请用 update()。
   */
  async load(workflows: unknown[]): Promise<LoadResult> {
    let loaded = 0;
    let skipped = 0;
    const errors: LoadResult["errors"] = [];

    for (const raw of workflows) {
      try {
        const parsed = WorkflowProtocolSchema.parse(raw);
        const existing = await this.get(parsed.id);
        if (existing) {
          skipped++;
          continue;
        }
        await this.storage.create(COLLECTION, {
          ...parsed,
          id: parsed.id,
          updated_at: new Date().toISOString(),
        });
        loaded++;
      } catch (err) {
        const id = (raw as Record<string, unknown>)?.id as string | undefined;
        errors.push({ id, reason: err instanceof Error ? err.message : String(err) });
      }
    }

    return { loaded, skipped, errors };
  }
}
