/**
 * GovernanceEngine — mutation 前的规则校验引擎。
 *
 * 设计：
 * - 每个协议注册自己的规则（GovernanceRule）
 * - mutation 前调用 engine.enforce()，规则按优先级依次执行
 * - 任何规则返回 violation 即阻断操作
 * - 所有校验结果可审计（返回完整 report）
 *
 * 这是 MoonOS 的核心差异化：不只是存数据，而是让治理规则成为系统行为的一部分。
 */

/** 规则违规描述 */
export interface GovernanceViolation {
  rule: string;
  message: string;
  severity: "error" | "warning";
  /** 可选的翻译 key（CLI 可用它替换 message） */
  message_key?: string;
  /** message_key 的插值参数 */
  message_params?: Record<string, unknown>;
  /** 被违规的资产 ID（可选） */
  asset_id?: string;
  /** 建议的修复方式 */
  suggestion?: string;
}

/** 规则执行结果 */
export interface GovernanceResult {
  passed: boolean;
  violations: GovernanceViolation[];
  warnings: GovernanceViolation[];
}

/**
 * 治理规则接口。
 * 每条规则负责一个关注点，返回违规列表（空 = 通过）。
 */
export interface GovernanceRule<T = unknown> {
  /** 规则唯一 ID */
  id: string;
  /** 规则描述 */
  description: string;
  /** 适用的操作类型 */
  operations: string[];
  /** 优先级，数字越小越先执行 */
  priority: number;
  /** 执行规则，返回违规列表 */
  check(operation: string, data: T, context?: GovernanceContext): GovernanceViolation[];
}

/** 规则执行时的上下文（可选，用于跨规则共享信息） */
export interface GovernanceContext {
  /** 当前时间（可注入，方便测试） */
  now?: Date;
  /** 已有资产（用于冲突检测等） */
  existing?: unknown;
  /** 额外元数据 */
  [key: string]: unknown;
}

export class GovernanceEngine {
  private rules: GovernanceRule[] = [];

  /** 注册规则 */
  register(rule: GovernanceRule): void {
    this.rules.push(rule);
    // 按优先级排序
    this.rules.sort((a, b) => a.priority - b.priority);
  }

  /** 批量注册 */
  registerAll(rules: GovernanceRule[]): void {
    for (const rule of rules) {
      this.register(rule);
    }
  }

  /** 获取已注册的规则列表 */
  listRules(): Array<{ id: string; description: string; operations: string[]; priority: number }> {
    return this.rules.map((r) => ({
      id: r.id,
      description: r.description,
      operations: r.operations,
      priority: r.priority,
    }));
  }

  /**
   * 执行治理校验。
   * @returns GovernanceResult，如果有 error 级违规则 passed=false
   */
  check(operation: string, data: unknown, context?: GovernanceContext): GovernanceResult {
    const violations: GovernanceViolation[] = [];
    const warnings: GovernanceViolation[] = [];

    const applicableRules = this.rules.filter(
      (r) => r.operations.includes(operation) || r.operations.includes("*"),
    );

    for (const rule of applicableRules) {
      const results = rule.check(operation, data, context);
      for (const v of results) {
        if (v.severity === "error") {
          violations.push(v);
        } else {
          warnings.push(v);
        }
      }
    }

    return {
      passed: violations.length === 0,
      violations,
      warnings,
    };
  }

  /**
   * 执行治理校验，如果有 error 级违规则抛异常。
   */
  enforce(operation: string, data: unknown, context?: GovernanceContext): GovernanceResult {
    const result = this.check(operation, data, context);
    if (!result.passed) {
      const messages = result.violations.map((v) => `[${v.rule}] ${v.message}`).join("\n");
      throw new GovernanceViolationError(messages, result);
    }
    return result;
  }
}

export class GovernanceViolationError extends Error {
  constructor(
    message: string,
    public readonly result: GovernanceResult,
  ) {
    super(`Governance violation:\n${message}`);
    this.name = "GovernanceViolationError";
  }
}
