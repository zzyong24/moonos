/**
 * 通用生命周期状态 + 转换规则。
 * Memory 用 5 态，其他协议可以复用或扩展。
 */
import { z } from "zod";

export const AssetLifecycleSchema = z.enum([
  "hypothesis",
  "active",
  "deprecated",
  "falsified",
  "archived",
]);

export type AssetLifecycle = z.infer<typeof AssetLifecycleSchema>;

/** 合法的生命周期转换表 */
const VALID_TRANSITIONS: Record<AssetLifecycle, AssetLifecycle[]> = {
  hypothesis: ["active", "archived", "falsified"],
  active: ["hypothesis", "deprecated", "falsified", "archived"],
  deprecated: ["hypothesis", "archived", "falsified"],
  falsified: ["archived"],
  archived: [], // 终态
};

export function canTransition(from: AssetLifecycle, to: AssetLifecycle): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export class LifecycleTransitionError extends Error {
  constructor(from: AssetLifecycle, to: AssetLifecycle) {
    super(`Invalid lifecycle transition: ${from} → ${to}`);
    this.name = "LifecycleTransitionError";
  }
}

export function assertTransition(from: AssetLifecycle, to: AssetLifecycle): void {
  if (!canTransition(from, to)) {
    throw new LifecycleTransitionError(from, to);
  }
}
