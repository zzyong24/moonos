/**
 * FalsificationReport 生成器 — 月度被证伪判断报告。
 *
 * 协议要求：
 * - 每月 1 号自动生成上月报告
 * - 数据源：Trace(falsified events) + Memory(review downgrade/falsify) + Feedback(critical)
 * - 报告不可篡改（SHA256 hash）
 * - 高影响 judgment 自动冻结关联 Memory
 * - 报告确认后才可继续使用核心功能
 */
import { createHash } from "node:crypto";
import { nanoid } from "nanoid";
import { MoonOSError } from "../errors.js";
import type { StorageAdapter } from "../../storage/interface.js";
import type { MemoryItem } from "../../protocols/memory/schema.js";
import type { TraceProtocol } from "../../protocols/trace/schema.js";
import type { ExternalFeedback } from "../../protocols/feedback/schema.js";

export interface FalsificationJudgment {
  judgment_id: string;
  title: string;
  impact: "low" | "medium" | "high";
  source: "trace" | "memory_review" | "external_feedback";
  evidence_refs: string[];
  affected_assets: string[];
  required_actions: string[];
}

export interface FalsificationReport {
  report_id: string;
  month: string; // YYYY-MM
  generated_at: string;
  sources: string[];
  summary: {
    falsified_judgments: number;
    high_impact_judgments: number;
    frozen_memories: number;
    workflow_patch_proposals: number;
  };
  judgments: FalsificationJudgment[];
  integrity: {
    hash: string;
    immutable: true;
    archived_to_vault: true;
  };
  acknowledgement: {
    required_before_core_use: true;
    acknowledged_at?: string;
  };
}

export interface ReportGenerationResult {
  report: FalsificationReport;
  actions_taken: string[];
}

export class FalsificationReportGenerator {
  constructor(private storage: StorageAdapter) {}

  /**
   * 为指定月份生成被证伪判断报告。
   * @param month YYYY-MM 格式
   */
  async generate(month: string): Promise<ReportGenerationResult> {
    const judgments: FalsificationJudgment[] = [];
    const actionsTaken: string[] = [];

    // 1. 从 Trace 中提取被证伪假设
    const traces = await this.storage.list<TraceProtocol & { id: string }>("trace");
    for (const trace of traces) {
      for (const event of trace.events) {
        if (event.type === "hypothesis_falsified") {
          const payload = event.payload as Record<string, unknown>;
          judgments.push({
            judgment_id: `judge_${nanoid(8)}`,
            title: (payload.hypothesis as string) ?? "未知假设",
            impact: "medium",
            source: "trace",
            evidence_refs: [trace.trace_id],
            affected_assets: trace.workflow_id ? [trace.workflow_id] : [],
            required_actions: ["复审关联记忆"],
          });
        }
      }
    }

    // 2. 从 Memory 中提取被证伪/降级的记忆
    const memories = await this.storage.list<MemoryItem & { id: string }>("memory");
    for (const mem of memories) {
      if (mem.status === "falsified") {
        judgments.push({
          judgment_id: `judge_${nanoid(8)}`,
          title: `记忆被证伪: ${mem.title}`,
          impact: mem.scope === "global" ? "high" : "medium",
          source: "memory_review",
          evidence_refs: [mem.id],
          affected_assets: mem.related_items ?? [],
          required_actions: mem.scope === "global"
            ? ["冻结关联记忆", "生成工作流 patch proposal"]
            : ["标记为已处理"],
        });
      }
    }

    // 3. 从 Feedback 中提取 critical 反馈
    const feedbacks = await this.storage.list<ExternalFeedback & { id: string }>("feedback");
    for (const fb of feedbacks) {
      if (fb.stance === "contradictory" || (fb.resolution.severity === "critical" || fb.resolution.severity === "high")) {
        judgments.push({
          judgment_id: `judge_${nanoid(8)}`,
          title: `外部反馈: ${fb.summary}`,
          impact: fb.resolution.severity === "critical" ? "high" : "medium",
          source: "external_feedback",
          evidence_refs: [fb.feedback_id],
          affected_assets: fb.linked_assets ?? [],
          required_actions: fb.action_required ? [fb.suggested_action ?? "处理反馈"] : [],
        });
      }
    }

    // 统计
    const highImpact = judgments.filter((j) => j.impact === "high");

    // 4. 高影响 judgment → 冻结关联 Memory
    let frozenCount = 0;
    for (const j of highImpact) {
      for (const assetId of j.affected_assets) {
        const mem = await this.storage.get<MemoryItem & { id: string }>("memory", assetId);
        if (mem && mem.status === "active") {
          await this.storage.update("memory", assetId, {
            ...mem,
            review: { ...mem.review, state: "frozen", last_outcome: "frozen" },
            updated_at: new Date().toISOString(),
          });
          frozenCount++;
          actionsTaken.push(`Frozen memory: ${assetId}`);
        }
      }
    }

    // 5. 组装报告
    const report: FalsificationReport = {
      report_id: `falsification_${month.replace("-", "_")}`,
      month,
      generated_at: new Date().toISOString(),
      sources: ["trace", "memory_review", "external_feedback"],
      summary: {
        falsified_judgments: judgments.length,
        high_impact_judgments: highImpact.length,
        frozen_memories: frozenCount,
        workflow_patch_proposals: highImpact.length, // 每个高影响都建议 patch
      },
      judgments,
      integrity: {
        hash: "", // 下面计算
        immutable: true,
        archived_to_vault: true,
      },
      acknowledgement: {
        required_before_core_use: true,
      },
    };

    // 计算完整性 hash（不含 hash 自身）
    const hashInput = JSON.stringify({ ...report, integrity: { ...report.integrity, hash: "" } });
    report.integrity.hash = `sha256:${createHash("sha256").update(hashInput).digest("hex")}`;

    // 6. 保存到 reports/falsification/
    await this.saveReport(report);
    actionsTaken.push(`Report saved: ${report.report_id}`);

    return { report, actions_taken: actionsTaken };
  }

  /** 获取指定月份的报告 */
  async getReport(month: string): Promise<FalsificationReport | null> {
    const reportId = `falsification_${month.replace("-", "_")}`;
    return this.storage.get<FalsificationReport>(`reports/falsification`, reportId);
  }

  /** 列出所有报告 */
  async listReports(): Promise<FalsificationReport[]> {
    return this.storage.list<FalsificationReport>(`reports/falsification`);
  }

  /** 确认报告（标记 acknowledged_at） */
  async acknowledgeReport(month: string): Promise<FalsificationReport> {
    const report = await this.getReport(month);
    if (!report) {
      throw new MoonOSError(
        "error.report.notFound",
        `Report not found: ${month}`,
        { month },
      );
    }

    const updated: FalsificationReport = {
      ...report,
      acknowledgement: {
        ...report.acknowledgement,
        acknowledged_at: new Date().toISOString(),
      },
    };

    const reportId = `falsification_${month.replace("-", "_")}`;
    await this.storage.update(`reports/falsification`, reportId, { ...updated, id: reportId });
    return updated;
  }

  // ─── Internal ───────────────────────────────────────────────

  private async saveReport(report: FalsificationReport): Promise<void> {
    const reportId = report.report_id;
    // 确保目录存在
    try {
      await this.storage.create(`reports/falsification`, { ...report, id: reportId });
    } catch {
      // 已存在则更新（幂等）
      await this.storage.update(`reports/falsification`, reportId, { ...report, id: reportId });
    }
  }
}
