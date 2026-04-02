/**
 * MemoryService — Memory 协议的业务逻辑层。
 *
 * 调用链：CLI → MemoryService → GovernanceEngine → StorageAdapter
 *
 * Phase 2 增强：
 * - 接入 GovernanceEngine，所有 mutation 前走规则校验
 * - activate：hypothesis → active 的正式激活流程
 * - addCounterEvidence / removeCounterEvidence
 * - batchReview：一次性处理多条到期记忆
 * - autoDowngrade：自动降级超过 grace period 的记忆
 */
import { nanoid } from "nanoid";
import { MoonOSError } from "../errors.js";
import type { StorageAdapter, QueryFilter } from "../../storage/interface.js";
import {
  CreateMemoryInputSchema,
  MemoryItemSchema,
  type MemoryItem,
  type CreateMemoryInput,
} from "../../protocols/memory/schema.js";
import {
  MEMORY_GOVERNANCE,
  isGlobalDirectional,
  computeExpiresAt,
  shouldDowngrade,
  findExpiredMemories,
  isInReminderWindow,
  isInGracePeriod,
} from "../../protocols/memory/governance.js";
import type { AssetLifecycle } from "../../protocols/_shared/lifecycle.js";
import { assertTransition } from "../../protocols/_shared/lifecycle.js";
import { GovernanceEngine } from "../governance/engine.js";
import { MEMORY_GOVERNANCE_RULES } from "../governance/rules.js";
import type { GovernanceResult } from "../governance/engine.js";

const COLLECTION = "memory";

export type ReviewDecision = "confirm" | "delay" | "deprecate" | "falsify";
export type BatchReviewDecision = "confirm" | "delay" | "skip";

export interface BatchReviewItem {
  memory: MemoryItem;
  decision: BatchReviewDecision;
  notes?: string;
}

export interface BatchReviewResult {
  processed: number;
  confirmed: number;
  delayed: number;
  skipped: number;
  warnings: string[];
  items: MemoryItem[];
}

export interface DowngradeResult {
  downgraded: number;
  items: MemoryItem[];
}

export interface MemoryStats {
  total: number;
  by_status: Record<string, number>;
  by_type: Record<string, number>;
  expiring_soon: number;  // 在提醒窗口内
  overdue: number;        // 已过期但在 grace period
  needs_downgrade: number; // 超过 grace period，应自动降级
}

function createGovernanceEngine(): GovernanceEngine {
  const engine = new GovernanceEngine();
  engine.registerAll(MEMORY_GOVERNANCE_RULES);
  return engine;
}

export class MemoryService {
  private governance: GovernanceEngine;

  constructor(
    private storage: StorageAdapter,
    governance?: GovernanceEngine,
  ) {
    this.governance = governance ?? createGovernanceEngine();
  }

  // ─── Create ─────────────────────────────────────────────────

  async create(input: CreateMemoryInput): Promise<{ item: MemoryItem; governance: GovernanceResult }> {
    const parsed = CreateMemoryInputSchema.parse(input);
    const now = new Date();
    const nowStr = now.toISOString();

    let expiresAt: string | undefined;
    if (isGlobalDirectional(parsed)) {
      expiresAt = computeExpiresAt(now, MEMORY_GOVERNANCE.MAX_EXPIRY_DAYS);
    }

    const reviewAt = expiresAt
      ? computeExpiresAt(
          new Date(new Date(expiresAt).getTime() - MEMORY_GOVERNANCE.REMINDER_WINDOW_DAYS * 86400_000),
          0,
        )
      : computeExpiresAt(now, MEMORY_GOVERNANCE.DEFAULT_REVALIDATION_DAYS);

    const item: MemoryItem = MemoryItemSchema.parse({
      id: `mem_${nanoid(12)}`,
      type: parsed.type,
      title: parsed.title,
      summary: parsed.summary,
      content: parsed.content,
      source: parsed.source,
      scope: parsed.scope,
      product: parsed.product,
      tags: parsed.tags,
      status: "hypothesis" as const,
      confidence: parsed.confidence,
      expires_at: expiresAt,
      counter_evidence: parsed.counter_evidence,
      related_items: [],
      review: {
        policy: isGlobalDirectional(parsed) ? "expiring" : "manual",
        next_review_at: reviewAt,
        state: "scheduled",
        degrade_to: "hypothesis",
      },
      created_at: nowStr,
      updated_at: nowStr,
    });

    const govResult = this.governance.enforce("memory:create", item, { now });
    const created = await this.storage.create(COLLECTION, item);
    return { item: created, governance: govResult };
  }

  // ─── Read ───────────────────────────────────────────────────

  async get(id: string): Promise<MemoryItem | null> {
    return this.storage.get<MemoryItem>(COLLECTION, id);
  }

  async list(filter?: QueryFilter): Promise<MemoryItem[]> {
    return this.storage.list<MemoryItem>(COLLECTION, filter);
  }

  async count(): Promise<number> {
    return this.storage.count(COLLECTION);
  }

  // ─── Activate ───────────────────────────────────────────────

  async activate(id: string, notes?: string): Promise<{ item: MemoryItem; governance: GovernanceResult }> {
    const item = await this.requireItem(id);
    assertTransition(item.status, "active");

    const now = new Date();
    const nowStr = now.toISOString();
    const newExpiry = computeExpiresAt(now, MEMORY_GOVERNANCE.DEFAULT_REVALIDATION_DAYS);
    const newReviewAt = computeExpiresAt(
      new Date(new Date(newExpiry).getTime() - MEMORY_GOVERNANCE.REMINDER_WINDOW_DAYS * 86400_000),
      0,
    );

    const activated: MemoryItem = {
      ...item,
      status: "active",
      expires_at: newExpiry,
      last_validated_at: nowStr,
      updated_at: nowStr,
      review: {
        ...item.review,
        state: "revalidated",
        last_outcome: "confirmed",
        next_review_at: newReviewAt,
        reviewed_at: nowStr,
        note: notes,
      },
    };

    const govResult = this.governance.check("memory:activate", activated, { now });
    if (!govResult.passed) {
      this.governance.enforce("memory:activate", activated, { now });
    }

    const updated = await this.storage.update(COLLECTION, id, activated);
    return { item: updated, governance: govResult };
  }

  // ─── Review ─────────────────────────────────────────────────

  async review(
    id: string,
    decision: ReviewDecision,
    notes?: string,
  ): Promise<{ item: MemoryItem; governance: GovernanceResult }> {
    const item = await this.requireItem(id);
    const now = new Date();
    const nowStr = now.toISOString();

    let updated: MemoryItem;
    let govOp: string;

    switch (decision) {
      case "confirm": {
        const newExpiry = computeExpiresAt(now, MEMORY_GOVERNANCE.DEFAULT_REVALIDATION_DAYS);
        const newReviewAt = computeExpiresAt(
          new Date(new Date(newExpiry).getTime() - MEMORY_GOVERNANCE.REMINDER_WINDOW_DAYS * 86400_000),
          0,
        );
        updated = {
          ...item,
          status: "active",
          expires_at: newExpiry,
          last_validated_at: nowStr,
          updated_at: nowStr,
          review: {
            ...item.review,
            state: "revalidated",
            last_outcome: "confirmed",
            next_review_at: newReviewAt,
            reviewed_at: nowStr,
            note: notes,
          },
        };
        govOp = "memory:review-confirm";
        break;
      }

      case "delay": {
        const delayDays = MEMORY_GOVERNANCE.QUICK_DELAY_DAYS;
        const newReviewAt = computeExpiresAt(now, delayDays);
        const newExpiry = item.expires_at
          ? computeExpiresAt(new Date(item.expires_at), delayDays)
          : undefined;
        updated = {
          ...item,
          expires_at: newExpiry,
          updated_at: nowStr,
          review: {
            ...item.review,
            state: "scheduled",
            last_outcome: "delayed",
            next_review_at: newReviewAt,
            reviewed_at: nowStr,
            note: notes ?? `Quick delay by ${delayDays} days`,
          },
        };
        govOp = "memory:review-delay";
        break;
      }

      case "deprecate": {
        assertTransition(item.status, "deprecated");
        updated = {
          ...item,
          status: "deprecated",
          updated_at: nowStr,
          review: {
            ...item.review,
            state: "downgraded",
            last_outcome: "downgraded",
            reviewed_at: nowStr,
            note: notes ?? "Manually deprecated by user",
          },
        };
        govOp = "memory:review-deprecate";
        break;
      }

      case "falsify": {
        assertTransition(item.status, "falsified");
        updated = {
          ...item,
          status: "falsified",
          updated_at: nowStr,
          review: {
            ...item.review,
            state: "downgraded",
            last_outcome: "falsified",
            reviewed_at: nowStr,
            note: notes ?? "Manually marked as falsified by user",
          },
        };
        govOp = "memory:review-falsify";
        break;
      }

      default:
        throw new MoonOSError(
          "error.memory.unknownReviewDecision",
          `Unknown review decision: ${decision}`,
          { decision },
        );
    }

    const govResult = this.governance.check(govOp, updated, { now });
    const saved = await this.storage.update(COLLECTION, id, updated);
    return { item: saved, governance: govResult };
  }

  // ─── Batch Review ───────────────────────────────────────────

  async findNeedingReview(): Promise<MemoryItem[]> {
    const all = await this.list({ where: { status: "active" } });
    return findExpiredMemories(all);
  }

  async findExpiringSoon(): Promise<MemoryItem[]> {
    const all = await this.list({ where: { status: "active" } });
    return all.filter((m) => isInReminderWindow(m));
  }

  async findInGracePeriod(): Promise<MemoryItem[]> {
    const all = await this.list({ where: { status: "active" } });
    return all.filter((m) => isInGracePeriod(m));
  }

  async batchReview(items: BatchReviewItem[]): Promise<BatchReviewResult> {
    const result: BatchReviewResult = {
      processed: 0,
      confirmed: 0,
      delayed: 0,
      skipped: 0,
      warnings: [],
      items: [],
    };

    for (const { memory, decision, notes } of items) {
      if (decision === "skip") {
        result.skipped++;
        result.processed++;
        continue;
      }

      try {
        const { item: reviewed, governance: govResult } = await this.review(
          memory.id,
          decision,
          notes,
        );

        if (decision === "confirm") result.confirmed++;
        if (decision === "delay") result.delayed++;
        result.items.push(reviewed);

        for (const w of govResult.warnings) {
          result.warnings.push(`[${memory.id}] ${w.message}`);
        }
      } catch (err) {
        result.warnings.push(`[${memory.id}] Review failed: ${(err as Error).message}`);
      }

      result.processed++;
    }

    return result;
  }

  async batchConfirmAll(notes?: string): Promise<BatchReviewResult> {
    const needsReview = await this.findNeedingReview();
    const items: BatchReviewItem[] = needsReview.map((m) => ({
      memory: m,
      decision: "confirm" as const,
      notes,
    }));
    return this.batchReview(items);
  }

  async batchDelayAll(notes?: string): Promise<BatchReviewResult> {
    const needsReview = await this.findNeedingReview();
    const items: BatchReviewItem[] = needsReview.map((m) => ({
      memory: m,
      decision: "delay" as const,
      notes,
    }));
    return this.batchReview(items);
  }

  // ─── Auto Downgrade ─────────────────────────────────────────

  async autoDowngrade(): Promise<DowngradeResult> {
    const all = await this.list({ where: { status: "active" } });
    const targets = all.filter((m) => shouldDowngrade(m));
    const items: MemoryItem[] = [];

    for (const item of targets) {
      const updated: MemoryItem = {
        ...item,
        status: "hypothesis",
        updated_at: new Date().toISOString(),
        review: {
          ...item.review,
          state: "downgraded",
          last_outcome: "downgraded",
          reviewed_at: new Date().toISOString(),
          note: "Automatically downgraded after grace period without review",
        },
      };
      const result = await this.storage.update(COLLECTION, item.id, updated);
      items.push(result);
    }

    return { downgraded: items.length, items };
  }

  // ─── Counter Evidence ───────────────────────────────────────

  async addCounterEvidence(id: string, evidence: string): Promise<MemoryItem> {
    const item = await this.requireItem(id);
    if (item.counter_evidence.includes(evidence)) {
      return item;
    }

    const updated: MemoryItem = {
      ...item,
      counter_evidence: [...item.counter_evidence, evidence],
      updated_at: new Date().toISOString(),
    };
    return this.storage.update(COLLECTION, id, updated);
  }

  async removeCounterEvidence(id: string, evidence: string): Promise<MemoryItem> {
    const item = await this.requireItem(id);
    const updated: MemoryItem = {
      ...item,
      counter_evidence: item.counter_evidence.filter((e) => e !== evidence),
      updated_at: new Date().toISOString(),
    };
    return this.storage.update(COLLECTION, id, updated);
  }

  // ─── Stats ──────────────────────────────────────────────────

  async stats(): Promise<MemoryStats> {
    const all = await this.list();
    const now = new Date();

    const by_status: Record<string, number> = {};
    const by_type: Record<string, number> = {};
    let expiring_soon = 0;
    let overdue = 0;
    let needs_downgrade = 0;

    for (const m of all) {
      by_status[m.status] = (by_status[m.status] ?? 0) + 1;
      by_type[m.type] = (by_type[m.type] ?? 0) + 1;

      if (isInReminderWindow(m, now)) expiring_soon++;
      if (isInGracePeriod(m, now)) overdue++;
      if (shouldDowngrade(m, now)) needs_downgrade++;
    }

    return {
      total: all.length,
      by_status,
      by_type,
      expiring_soon,
      overdue,
      needs_downgrade,
    };
  }

  // ─── Internal ───────────────────────────────────────────────

  private async requireItem(id: string): Promise<MemoryItem> {
    const item = await this.get(id);
    if (!item) {
      throw new MoonOSError(
        "error.memory.notFound",
        `Memory not found: ${id}`,
        { id },
      );
    }
    return item;
  }

  // ─── Briefing（给 AI 用的极简摘要）──────────────────────────

  async briefing(): Promise<string> {
    const all = await this.list();
    const s = await this.stats();
    const lines: string[] = [];

    lines.push(`[MoonOS Memory] ${s.total} items | active:${s.by_status.active ?? 0} hypo:${s.by_status.hypothesis ?? 0} falsified:${s.by_status.falsified ?? 0}`);

    if (s.expiring_soon > 0) lines.push(`⚡ ${s.expiring_soon} expiring soon`);
    if (s.overdue > 0) lines.push(`⚠ ${s.overdue} overdue (in grace period)`);
    if (s.needs_downgrade > 0) lines.push(`🔴 ${s.needs_downgrade} needs auto-downgrade`);

    const active = all.filter((m) => m.status === "active");
    if (active.length > 0) {
      lines.push("");
      lines.push("## Active");
      for (const m of active) {
        const ce = m.counter_evidence.length > 0 ? ` [counter:${m.counter_evidence.length}]` : "";
        lines.push(`- [${m.type}] ${m.title} (${m.id})${ce}`);
      }

    }

    const hypothesis = all.filter((m) => m.status === "hypothesis");
    if (hypothesis.length > 0) {
      lines.push("");
      lines.push(`## Hypothesis (${hypothesis.length})`);
      const recent = hypothesis.slice(0, 10);
      for (const m of recent) {
        lines.push(`- [${m.type}] ${m.title} (${m.id})`);
      }
      if (hypothesis.length > 10) {
        lines.push(`  ... +${hypothesis.length - 10} more`);
      }
    }

    const falsified = all.filter((m) => m.status === "falsified");
    if (falsified.length > 0) {
      lines.push("");
      lines.push("## Falsified");
      for (const m of falsified) {
        lines.push(`- ${m.title} (${m.id})`);
      }
    }

    return lines.join("\n");
  }
}
