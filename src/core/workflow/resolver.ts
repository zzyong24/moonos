/**
 * ParamResolver — 4 层参数补全策略。
 *
 * Layer 1: Direct Match     — 从上游输出 / 用户参数直取同名字段（零成本）
 * Layer 2: Schema Match     — 语义别名映射（零成本，别名表外部注入）
 * Layer 3: External Resolve — 调外部函数补全参数（如 vault_place，由调用方注入）
 * Layer 4: LLM Reasoning    — 调 LLM 推理补全（最后手段，本版不实现）
 *
 * 设计原则：
 * - 框架不知道任何具体工具名，所有业务知识通过配置注入
 * - 每层只补前层没补到的字段，不覆盖已有值
 * - 每次补全都产出 ParamResolvedPayload 供 trace 记录
 * - resolver_policy 控制启用哪些层
 */
import type { ResolverPolicy, ResolveStrategy } from "../../protocols/workflow/schema.js";
import type { ParamResolvedPayload } from "../../protocols/trace/schema.js";

// ─── Types ───────────────────────────────────────────────────

export interface ToolSchema {
  name: string;
  description?: string;
  inputSchema?: {
    properties?: Record<string, PropertySchema>;
    required?: string[];
  };
}

export interface PropertySchema {
  type?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
}

export interface ResolveRequest {
  toolName: string;
  /** 上游节点输出 + 用户直传参数，合并后的 pool */
  paramPool: Record<string, unknown>;
  resolverPolicy: ResolverPolicy;
}

export interface ResolveResult {
  params: Record<string, unknown>;
  traces: ParamResolvedPayload[];
  /** 仍未解决的 required 字段 */
  unresolved: string[];
}

/** MCP 调用函数签名 */
export type McpCallFn = (tool: string, params: Record<string, unknown>) => Promise<string>;

/**
 * Layer 3 外部解析函数。
 * 调用方注入具体实现（如 vault_place 桥接）。
 * 接收工具名 + 当前参数池，返回补全的字段或 null。
 */
export type ExternalResolveFn = (
  toolName: string,
  paramPool: Record<string, unknown>,
) => Promise<Record<string, unknown> | null>;

// ─── Resolver Config ─────────────────────────────────────────

export interface ResolverConfig {
  /** Layer 2: 字段别名映射表。key=目标字段，value=可匹配的上游字段名 */
  aliases?: Record<string, string[]>;
  /** Layer 3: 外部解析函数，如 vault_place 桥接 */
  externalResolve?: ExternalResolveFn;
}

/** 通用的语义别名，不绑定任何具体业务 */
const DEFAULT_ALIASES: Record<string, string[]> = {
  output_path: ["path", "absolute_path", "file_path", "output_file"],
  file_path: ["path", "absolute_path", "output_path"],
  content: ["body", "text", "markdown"],
  title: ["name"],
  url: ["source_url", "link", "href"],
  tags: ["labels", "keywords"],
  summary: ["abstract", "description"],
};

// ─── Resolver ────────────────────────────────────────────────

export class ParamResolver {
  private aliases: Record<string, string[]>;
  private externalResolve: ExternalResolveFn | null;

  constructor(
    private toolSchemas: Map<string, ToolSchema>,
    config?: ResolverConfig,
  ) {
    this.aliases = { ...DEFAULT_ALIASES, ...config?.aliases };
    this.externalResolve = config?.externalResolve ?? null;
  }

  async resolve(request: ResolveRequest): Promise<ResolveResult> {
    const schema = this.toolSchemas.get(request.toolName);
    const required = schema?.inputSchema?.required ?? [];
    const properties = schema?.inputSchema?.properties ?? {};
    const resolved: Record<string, unknown> = {};
    const traces: ParamResolvedPayload[] = [];

    // 把用户传的可选参数也先收集（非 required 的直接透传）
    for (const [key, value] of Object.entries(request.paramPool)) {
      if (key in properties && value !== undefined && value !== null) {
        resolved[key] = value;
      }
    }

    const strategies = request.resolverPolicy.enabled
      ? request.resolverPolicy.strategy_order
      : [];

    // Layer 3 结果缓存，避免同一工具重复调用
    let externalCache: Record<string, unknown> | null | undefined;

    for (const field of required) {
      if (resolved[field] !== undefined) continue;

      for (const strategy of strategies) {
        if (resolved[field] !== undefined) break;

        switch (strategy) {
          case "direct":
            resolved[field] = this.directMatch(field, request.paramPool);
            if (resolved[field] !== undefined) {
              traces.push(this.makeTrace(field, resolved[field], "direct"));
            }
            break;

          case "schema-match":
            resolved[field] = this.schemaMatch(field, request.paramPool);
            if (resolved[field] !== undefined) {
              traces.push(this.makeTrace(field, resolved[field], "schema-match"));
            }
            break;

          case "vault-place":
            if (!this.externalResolve) break;

            // 只调一次
            if (externalCache === undefined) {
              externalCache = await this.externalResolve(request.toolName, request.paramPool);
            }
            if (externalCache && externalCache[field] !== undefined) {
              resolved[field] = externalCache[field];
              traces.push(this.makeTrace(field, resolved[field], "vault-place"));
            }
            break;

          case "llm":
            // Layer 4 — 本版不实现，占位
            break;
        }
      }
    }

    // Layer 3 可能返回了当前 field 循环还没到的字段，补上
    if (externalCache) {
      for (const field of required) {
        if (resolved[field] === undefined && externalCache[field] !== undefined) {
          resolved[field] = externalCache[field];
          traces.push(this.makeTrace(field, resolved[field], "vault-place"));
        }
      }
    }

    const unresolved = required.filter((f) => resolved[f] === undefined);
    return { params: resolved, traces, unresolved };
  }

  // ─── Layer 1: Direct Match ─────────────────────────────────

  private directMatch(field: string, pool: Record<string, unknown>): unknown {
    return pool[field];
  }

  // ─── Layer 2: Schema-Aware Match ───────────────────────────

  private schemaMatch(field: string, pool: Record<string, unknown>): unknown {
    const candidates = this.aliases[field];
    if (!candidates) return undefined;
    for (const alias of candidates) {
      if (pool[alias] !== undefined) return pool[alias];
    }
    return undefined;
  }

  // ─── Helpers ───────────────────────────────────────────────

  private makeTrace(field: string, value: unknown, strategy: ResolveStrategy): ParamResolvedPayload {
    return {
      field_name: field,
      resolved_value: value,
      strategy_used: strategy,
      context_refs: [],
      reasoning_snippet: "",
      replay_source: "resolver",
    };
  }
}
