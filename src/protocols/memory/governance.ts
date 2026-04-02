/**
 * Memory Governance Rules — 编码化的治理约束。
 *
 * 强制规则 A：全局方向型记忆最长 180 天
 * 强制规则 B：核心判断必须绑定反方锚点（才可进入默认注入层）
 * 强制规则 C：默认注入层必须可审计
 */
import type { MemoryItem, MemoryScope, MemoryType } from "./schema.js";

export const MEMORY_GOVERNANCE = {
  MAX_EXPIRY_DAYS: 180,
  GRACE_DAYS: 14,
  REMINDER_WINDOW_DAYS: 7,
  QUICK_DELAY_DAYS: 30,
  DEFAULT_REVALIDATION_DAYS: 180,
  BATCH_REVIEW_MAX: 50,
} as const;

export function isGlobalDirectional(item: { type: MemoryType; scope: MemoryScope }): boolean {
  if (item.scope !== "global") return false;
  return item.type === "policy" || item.type === "profile" || item.type === "context";
}

export function shouldDowngrade(item: MemoryItem, now: Date = new Date()): boolean {
  if (item.status !== "active") return false;
  if (!item.expires_at) return false;

  const expiresAt = new Date(item.expires_at);
  const graceEnd = new Date(expiresAt.getTime() + MEMORY_GOVERNANCE.GRACE_DAYS * 86400_000);

  return now >= graceEnd;
}

export function isInReminderWindow(item: MemoryItem, now: Date = new Date()): boolean {
  if (item.status !== "active") return false;
  if (!item.expires_at) return false;

  const expiresAt = new Date(item.expires_at);
  const reminderStart = new Date(expiresAt.getTime() - MEMORY_GOVERNANCE.REMINDER_WINDOW_DAYS * 86400_000);

  return now >= reminderStart && now < expiresAt;
}

export function isInGracePeriod(item: MemoryItem, now: Date = new Date()): boolean {
  if (item.status !== "active") return false;
  if (!item.expires_at) return false;

  const expiresAt = new Date(item.expires_at);
  const graceEnd = new Date(expiresAt.getTime() + MEMORY_GOVERNANCE.GRACE_DAYS * 86400_000);

  return now >= expiresAt && now < graceEnd;
}

export function findExpiredMemories(memories: MemoryItem[], now: Date = new Date()): MemoryItem[] {
  return memories.filter((m) => {
    if (m.status !== "active" || !m.expires_at) return false;
    return now >= new Date(m.expires_at);
  });
}

export function findDowngradeTargets(memories: MemoryItem[], now: Date = new Date()): MemoryItem[] {
  return memories.filter((m) => shouldDowngrade(m, now));
}

export function computeExpiresAt(fromDate: Date, days: number): string {
  const d = new Date(fromDate.getTime() + days * 86400_000);
  return d.toISOString();
}

export function validateExpiryForGlobalDirectional(
  item: { type: MemoryType; scope: MemoryScope; created_at: string; expires_at?: string },
): string | null {
  if (!isGlobalDirectional(item)) return null;
  if (!item.expires_at) return "Global directional memory must set expires_at";

  const created = new Date(item.created_at);
  const expires = new Date(item.expires_at);
  const maxExpires = new Date(created.getTime() + MEMORY_GOVERNANCE.MAX_EXPIRY_DAYS * 86400_000);

  if (expires > maxExpires) {
    return `Global directional memory expiry must not exceed ${MEMORY_GOVERNANCE.MAX_EXPIRY_DAYS} days`;
  }

  return null;
}
