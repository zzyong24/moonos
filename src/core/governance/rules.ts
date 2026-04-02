/**
 * Memory Governance Rules — 注册到 GovernanceEngine 的编码化规则。
 *
 * 规则对照协议设计文档：
 *   强制规则 A：全局方向型记忆最长 180 天
 *   强制规则 B：进入默认注入层的核心判断必须绑定反方锚点
 *   强制规则 C：默认注入层必须可审计（由 engine report 覆盖）
 */
import type { GovernanceRule, GovernanceViolation, GovernanceContext } from "./engine.js";
import type { MemoryItem, CreateMemoryInput } from "../../protocols/memory/schema.js";
import {
  isGlobalDirectional,
  MEMORY_GOVERNANCE,
  validateExpiryForGlobalDirectional,
} from "../../protocols/memory/governance.js";
import { canTransition } from "../../protocols/_shared/lifecycle.js";
import type { AssetLifecycle } from "../../protocols/_shared/lifecycle.js";

// ─── Rule: 全局方向型记忆必须设置有效期且不超过 180 天 ──────

export const globalDirectionalExpiryRule: GovernanceRule<MemoryItem> = {
  id: "memory.global-directional-expiry",
  description: `Global directional memories (policy/profile/context + global scope) must not exceed ${MEMORY_GOVERNANCE.MAX_EXPIRY_DAYS} days`,
  operations: ["memory:create", "memory:update"],
  priority: 10,
  check(_op, item): GovernanceViolation[] {
    if (!isGlobalDirectional(item)) return [];

    if (!item.expires_at) {
      return [{
        rule: "memory.global-directional-expiry",
        message: "Global directional memory must set expires_at",
        message_key: "governance.memory.globalDirectional.missingExpiresAt",
        severity: "error",
        asset_id: item.id,
        suggestion: `Set expires_at within ${MEMORY_GOVERNANCE.MAX_EXPIRY_DAYS} days after created_at`,
      }];
    }

    const msg = validateExpiryForGlobalDirectional(item);
    if (!msg) return [];
    return [{
      rule: "memory.global-directional-expiry",
      message: msg,
      message_key: "governance.memory.globalDirectional.expiryTooLong",
      message_params: { maxDays: MEMORY_GOVERNANCE.MAX_EXPIRY_DAYS },
      severity: "error",
      asset_id: item.id,
      suggestion: `Set expires_at within ${MEMORY_GOVERNANCE.MAX_EXPIRY_DAYS} days after created_at`,
    }];
  },
};

// ─── Rule: 激活为 active 时必须有反方锚点 ──────────────────

export const counterEvidenceRequiredRule: GovernanceRule<MemoryItem> = {
  id: "memory.counter-evidence-for-active",
  description: "Memories activated to active should add at least one counter-evidence anchor",
  operations: ["memory:activate", "memory:review-confirm"],
  priority: 20,
  check(_op, item): GovernanceViolation[] {
    if (!isGlobalDirectional(item)) return [];
    if (item.counter_evidence.length > 0) return [];

    return [{
      rule: "memory.counter-evidence-for-active",
      message: "Global directional memories should add at least one counter-evidence before activation",
      message_key: "governance.memory.counterEvidenceRequired",
      severity: "warning",
      asset_id: item.id,
      suggestion: "Use moonos memory add-counter-evidence <id> --text '...' to add counter-evidence",
    }];
  },
};

// ─── Rule: 生命周期转换必须合法 ────────────────────────────

export const lifecycleTransitionRule: GovernanceRule<{ current: AssetLifecycle; target: AssetLifecycle; id: string }> = {
  id: "memory.lifecycle-transition",
  description: "Lifecycle transitions must follow valid paths",
  operations: ["memory:transition"],
  priority: 5,
  check(_op, data): GovernanceViolation[] {
    if (canTransition(data.current, data.target)) return [];
    return [{
      rule: "memory.lifecycle-transition",
      message: `Invalid lifecycle transition: ${data.current} → ${data.target}`,
      message_key: "governance.memory.invalidTransition",
      message_params: { current: data.current, target: data.target },
      severity: "error",
      asset_id: data.id,
    }];
  },
};

// ─── Rule: confidence 异常低时提醒 ────────────────────────

export const lowConfidenceWarningRule: GovernanceRule<MemoryItem> = {
  id: "memory.low-confidence-warning",
  description: "Warn when a memory below 0.3 confidence is activated",
  operations: ["memory:activate", "memory:review-confirm"],
  priority: 30,
  check(_op, item): GovernanceViolation[] {
    if (item.confidence >= 0.3) return [];
    return [{
      rule: "memory.low-confidence-warning",
      message: `Memory confidence is only ${item.confidence}; collect more evidence before activation`,
      message_key: "governance.memory.lowConfidence",
      message_params: { confidence: item.confidence },
      severity: "warning",
      asset_id: item.id,
    }];
  },
};

// ─── 聚合导出 ──────────────────────────────────────────────

/** 所有 Memory 治理规则 */
export const MEMORY_GOVERNANCE_RULES: GovernanceRule[] = [
  globalDirectionalExpiryRule,
  counterEvidenceRequiredRule,
  lifecycleTransitionRule,
  lowConfidenceWarningRule,
];
