/**
 * WorkflowExecutor — 拓扑排序 + 顺序执行 + Trace 记录。
 *
 * 输入：WorkflowProtocol + 用户参数
 * 输出：TraceProtocol（完整执行痕迹）
 *
 * 框架不知道具体工具和业务：
 * - 工具调用通过注入的 McpCallFn
 * - 参数补全通过注入的 ResolverConfig
 * - workflow 定义从 WorkflowService 加载
 */
import { nanoid } from "nanoid";
import type { WorkflowProtocol, WorkflowNode } from "../../protocols/workflow/schema.js";
import type { TraceProtocol } from "../../protocols/trace/schema.js";
import type { StorageAdapter } from "../../storage/interface.js";
import { TraceService } from "../trace/service.js";
import { ParamResolver } from "./resolver.js";
import type { McpCallFn, ToolSchema, ResolverConfig } from "./resolver.js";

// ─── Types ───────────────────────────────────────────────────

export interface ExecutorConfig {
  storage: StorageAdapter;
  mcpCall: McpCallFn;
  toolSchemas: Map<string, ToolSchema>;
  resolver?: ResolverConfig;
}

export interface ExecuteOptions {
  /** 用户直传的输入参数 */
  userInputs: Record<string, unknown>;
  /** 当前 session id */
  sessionId?: string;
}

export interface ExecuteResult {
  trace: TraceProtocol;
  outputs: Map<string, unknown>;
  status: "success" | "failed" | "partial";
}

export interface NodeOutput {
  nodeId: string;
  result: unknown;
  skipped?: boolean;
  error?: string;
}

// ─── Executor ────────────────────────────────────────────────

export class WorkflowExecutor {
  private resolver: ParamResolver;
  private traceService: TraceService;
  private mcpCall: McpCallFn;

  constructor(config: ExecutorConfig) {
    this.mcpCall = config.mcpCall;
    this.resolver = new ParamResolver(config.toolSchemas, config.resolver);
    this.traceService = new TraceService(config.storage);
  }

  async execute(workflow: WorkflowProtocol, options: ExecuteOptions): Promise<ExecuteResult> {
    const sessionId = options.sessionId ?? `session_${nanoid(8)}`;
    const trace = await this.traceService.startTrace(sessionId, workflow.id);
    const outputs = new Map<string, unknown>();
    let hasError = false;

    const sorted = topoSort(workflow.nodes, workflow.edges);

    for (const node of sorted) {
      try {
        switch (node.type) {
          case "input": {
            outputs.set(node.id, options.userInputs);
            break;
          }

          case "tool": {
            const paramPool = this.collectUpstream(node.id, workflow, outputs, options.userInputs);

            const resolved = await this.resolver.resolve({
              toolName: node.tool,
              paramPool,
              resolverPolicy: this.mergePolicy(workflow, node),
            });

            for (const t of resolved.traces) {
              await this.traceService.appendParamResolved(trace.trace_id, node.id, t);
            }

            if (resolved.unresolved.length > 0) {
              await this.traceService.appendEvent(trace.trace_id, {
                type: "error_raised",
                node_id: node.id,
                payload: { error: `Unresolved params: ${resolved.unresolved.join(", ")}` },
              });
              hasError = true;
              outputs.set(node.id, { error: `Unresolved: ${resolved.unresolved.join(", ")}` });
              break;
            }

            await this.traceService.appendEvent(trace.trace_id, {
              type: "tool_called",
              node_id: node.id,
              payload: { tool: node.tool, params: resolved.params },
            });

            const result = await this.mcpCall(node.tool, resolved.params);

            await this.traceService.appendEvent(trace.trace_id, {
              type: "tool_returned",
              node_id: node.id,
              payload: { result_preview: String(result).slice(0, 500) },
            });

            outputs.set(node.id, result);
            break;
          }

          case "agent": {
            await this.traceService.appendEvent(trace.trace_id, {
              type: "agent_reasoned",
              node_id: node.id,
              payload: { status: "skip_v1", reason: "Agent nodes require LLM integration (planned for v2)" },
            });
            const upstream = this.collectUpstream(node.id, workflow, outputs, options.userInputs);
            outputs.set(node.id, upstream);
            break;
          }

          case "condition": {
            const upstream = this.collectUpstream(node.id, workflow, outputs, options.userInputs);
            outputs.set(node.id, upstream);
            break;
          }

          case "output": {
            const upstream = this.collectUpstream(node.id, workflow, outputs, options.userInputs);
            outputs.set(node.id, upstream);
            await this.traceService.appendEvent(trace.trace_id, {
              type: "output_saved",
              node_id: node.id,
              payload: { summary: Object.keys(upstream).join(", ") },
            });
            break;
          }
        }
      } catch (err) {
        hasError = true;
        const message = err instanceof Error ? err.message : String(err);
        await this.traceService.appendEvent(trace.trace_id, {
          type: "error_raised",
          node_id: node.id,
          payload: { error: message },
        });
        outputs.set(node.id, { error: message });

        if (workflow.policy.retry === 0) break;
      }
    }

    const status = hasError ? "failed" : "success";
    const finalized = await this.traceService.finalize(trace.trace_id, status);

    return { trace: finalized, outputs, status };
  }

  // ─── Internal ──────────────────────────────────────────────

  private collectUpstream(
    nodeId: string,
    workflow: WorkflowProtocol,
    outputs: Map<string, unknown>,
    userInputs: Record<string, unknown>,
  ): Record<string, unknown> {
    const pool: Record<string, unknown> = { ...userInputs };

    const incomingEdges = workflow.edges.filter((e) => e.to === nodeId);

    for (const edge of incomingEdges) {
      const upstreamOutput = outputs.get(edge.from);
      if (upstreamOutput && typeof upstreamOutput === "object" && !Array.isArray(upstreamOutput)) {
        for (const [key, value] of Object.entries(upstreamOutput as Record<string, unknown>)) {
          if (pool[key] === undefined) {
            pool[key] = value;
          }
        }
      } else if (upstreamOutput !== undefined) {
        pool[edge.from] = upstreamOutput;
      }
    }

    return pool;
  }

  private mergePolicy(workflow: WorkflowProtocol, node: WorkflowNode): typeof workflow.resolver_policy {
    const nodePolicy = node.resolve_policy;
    if (!nodePolicy || nodePolicy.mode === "inherit") {
      return workflow.resolver_policy;
    }
    return {
      ...workflow.resolver_policy,
      strategy_order: nodePolicy.allowed_strategies,
      ...(nodePolicy.disable_llm ? { llm_fallback: "disabled" as const } : {}),
      ...(nodePolicy.record_reasoning !== undefined ? { record_reasoning: nodePolicy.record_reasoning } : {}),
    };
  }
}

// ─── Topo Sort ───────────────────────────────────────────────

interface Edge {
  from: string;
  to: string;
}

function topoSort(nodes: WorkflowNode[], edges: Edge[]): WorkflowNode[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const n of nodes) {
    inDegree.set(n.id, 0);
    adj.set(n.id, []);
  }

  for (const e of edges) {
    adj.get(e.from)!.push(e.to);
    inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const sorted: WorkflowNode[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    sorted.push(nodeMap.get(id)!);
    for (const next of adj.get(id) ?? []) {
      const newDeg = (inDegree.get(next) ?? 1) - 1;
      inDegree.set(next, newDeg);
      if (newDeg === 0) queue.push(next);
    }
  }

  if (sorted.length !== nodes.length) {
    const missing = nodes.filter((n) => !sorted.find((s) => s.id === n.id)).map((n) => n.id);
    throw new Error(`Workflow has cycles involving nodes: ${missing.join(", ")}`);
  }

  return sorted;
}
