/**
 * TraceService — 执行痕迹记录服务。
 *
 * 核心价值：
 * - 成功流程可复现（trace-based replay）
 * - 失败路径可定位（哪一步出的问题）
 * - 经验可萃取（lessons / counterfactuals 自动沉淀）
 *
 * 设计：
 * - 一个 session 对应一条 trace
 * - trace 内追加 events（append-only）
 * - trace 完成后 finalize（设 status + lessons）
 */
import { nanoid } from "nanoid";
import { MoonOSError } from "../errors.js";
import type { StorageAdapter, QueryFilter } from "../../storage/interface.js";
import type { TraceProtocol, TraceEventType, ParamResolvedPayload } from "../../protocols/trace/schema.js";
import { TraceProtocolSchema, ParamResolvedPayloadSchema, TRACE_EVENT_GROUPS } from "../../protocols/trace/schema.js";
import type { TraceEventGroup } from "../../protocols/trace/schema.js";

const COLLECTION = "trace";

export interface TraceEvent {
  type: TraceEventType;
  node_id?: string;
  payload?: Record<string, unknown>;
}

export interface TraceFilterOptions {
  status?: string;
  workflow_id?: string;
  session_id?: string;
  limit?: number;
}

export interface TraceSummary {
  trace_id: string;
  session_id: string;
  workflow_id?: string;
  status: string;
  event_count: number;
  event_groups: Record<string, number>;
  has_failures: boolean;
  has_falsifications: boolean;
  lessons_count: number;
}

export class TraceService {
  constructor(private storage: StorageAdapter) {}

  // ─── Create / Start ─────────────────────────────────────────

  /** 开始新 trace（对应一个 session） */
  async startTrace(sessionId: string, workflowId?: string): Promise<TraceProtocol> {
    const now = new Date().toISOString();
    const trace: TraceProtocol = TraceProtocolSchema.parse({
      trace_id: `trace_${nanoid(12)}`,
      session_id: sessionId,
      workflow_id: workflowId,
      status: "partial",
      events: [{ ts: now, type: "session_started", payload: {} }],
      lessons: [],
      counterfactuals: [],
    });

    await this.storage.create(COLLECTION, { ...trace, id: trace.trace_id });
    return trace;
  }

  // ─── Append Events ──────────────────────────────────────────

  /** 追加事件到已有 trace */
  async appendEvent(traceId: string, event: TraceEvent): Promise<TraceProtocol> {
    const trace = await this.requireTrace(traceId);
    const now = new Date().toISOString();

    const newEvent = {
      ts: now,
      type: event.type,
      node_id: event.node_id,
      payload: event.payload ?? {},
    };

    const updated: TraceProtocol = {
      ...trace,
      events: [...trace.events, newEvent],
    };

    await this.storage.update(COLLECTION, traceId, { ...updated, id: traceId });
    return updated;
  }

  /** 追加 param_resolved 事件（强制核心字段校验） */
  async appendParamResolved(traceId: string, nodeId: string, payload: ParamResolvedPayload): Promise<TraceProtocol> {
    // 校验强制字段
    const validated = ParamResolvedPayloadSchema.parse(payload);
    return this.appendEvent(traceId, {
      type: "param_resolved",
      node_id: nodeId,
      payload: validated as unknown as Record<string, unknown>,
    });
  }

  // ─── Finalize ───────────────────────────────────────────────

  /** 完成 trace：设置最终状态、lessons、counterfactuals */
  async finalize(
    traceId: string,
    status: "success" | "failed" | "falsified",
    options?: { lessons?: string[]; counterfactuals?: string[] },
  ): Promise<TraceProtocol> {
    const trace = await this.requireTrace(traceId);

    const updated: TraceProtocol = {
      ...trace,
      status,
      lessons: [...trace.lessons, ...(options?.lessons ?? [])],
      counterfactuals: [...trace.counterfactuals, ...(options?.counterfactuals ?? [])],
    };

    await this.storage.update(COLLECTION, traceId, { ...updated, id: traceId });
    return updated;
  }

  // ─── Read ───────────────────────────────────────────────────

  async get(traceId: string): Promise<TraceProtocol | null> {
    const raw = await this.storage.get<TraceProtocol & { id: string }>(COLLECTION, traceId);
    return raw;
  }

  async list(options?: TraceFilterOptions): Promise<TraceProtocol[]> {
    const where: Record<string, unknown> = {};
    if (options?.status) where.status = options.status;
    if (options?.workflow_id) where.workflow_id = options.workflow_id;

    return this.storage.list<TraceProtocol>(COLLECTION, {
      where: Object.keys(where).length > 0 ? where : undefined,
      limit: options?.limit,
      sort_by: "updated_at",
      sort_order: "desc",
    });
  }

  async count(): Promise<number> {
    return this.storage.count(COLLECTION);
  }

  // ─── Analysis ───────────────────────────────────────────────

  /** 生成 trace 摘要 */
  summarize(trace: TraceProtocol): TraceSummary {
    const eventGroups: Record<string, number> = {};
    let hasFailures = false;
    let hasFalsifications = false;

    for (const event of trace.events) {
      const group = this.getEventGroup(event.type as TraceEventType);
      eventGroups[group] = (eventGroups[group] ?? 0) + 1;

      if (event.type === "error_raised" || event.type === "path_failed") hasFailures = true;
      if (event.type === "hypothesis_falsified" || event.type === "contradiction_found") hasFalsifications = true;
    }

    return {
      trace_id: trace.trace_id,
      session_id: trace.session_id,
      workflow_id: trace.workflow_id,
      status: trace.status,
      event_count: trace.events.length,
      event_groups: eventGroups,
      has_failures: hasFailures,
      has_falsifications: hasFalsifications,
      lessons_count: trace.lessons.length,
    };
  }

  /** 从所有 trace 中提取被证伪的假设 */
  async extractFalsifiedHypotheses(options?: { limit?: number }): Promise<Array<{
    trace_id: string;
    hypothesis: string;
    evidence: string;
    ts: string;
  }>> {
    const traces = await this.list({ limit: options?.limit ?? 100 });
    const results: Array<{ trace_id: string; hypothesis: string; evidence: string; ts: string }> = [];

    for (const trace of traces) {
      for (const event of trace.events) {
        if (event.type === "hypothesis_falsified") {
          results.push({
            trace_id: trace.trace_id,
            hypothesis: (event.payload as Record<string, unknown>).hypothesis as string ?? "",
            evidence: (event.payload as Record<string, unknown>).evidence as string ?? "",
            ts: event.ts,
          });
        }
      }
    }

    return results;
  }

  /** 从所有 trace 中提取失败路径 */
  async extractFailedPaths(options?: { limit?: number }): Promise<Array<{
    trace_id: string;
    node_id?: string;
    error: string;
    ts: string;
  }>> {
    const traces = await this.list({ limit: options?.limit ?? 100 });
    const results: Array<{ trace_id: string; node_id?: string; error: string; ts: string }> = [];

    for (const trace of traces) {
      for (const event of trace.events) {
        if (event.type === "error_raised" || event.type === "path_failed") {
          const payload = event.payload as Record<string, unknown>;
          results.push({
            trace_id: trace.trace_id,
            node_id: event.node_id,
            error: (payload.error ?? payload.message ?? "unknown") as string,
            ts: event.ts,
          });
        }
      }
    }

    return results;
  }

  // ─── Internal ───────────────────────────────────────────────

  private getEventGroup(eventType: TraceEventType): string {
    for (const [group, types] of Object.entries(TRACE_EVENT_GROUPS)) {
      if ((types as readonly string[]).includes(eventType)) return group;
    }
    return "unknown";
  }

  private async requireTrace(traceId: string): Promise<TraceProtocol> {
    const trace = await this.get(traceId);
    if (!trace) {
      throw new MoonOSError(
        "error.trace.notFound",
        `Trace not found: ${traceId}`,
        { id: traceId },
      );
    }
    return trace;
  }
}
