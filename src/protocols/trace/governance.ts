/** Trace Governance — param_resolved 强制字段、月报约束 */
export const TRACE_GOVERNANCE = {
  REQUIRED_FAILURE_EVENTS: ["hypothesis_falsified", "path_failed", "contradiction_found", "unexpected_feedback"] as const,
  MONTHLY_REPORTS: ["被证伪判断报告", "未探索路径报告", "外部负反馈汇总"] as const,
  PARAM_RESOLVED_REQUIRED_FIELDS: ["node_id", "field_name", "resolved_value", "strategy_used", "context_refs", "reasoning_snippet"] as const,
} as const;
