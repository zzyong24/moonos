/** Feedback Governance — 自动提案阈值 */
export const FEEDBACK_GOVERNANCE = {
  AUTO_PROPOSAL_MIN_CREDIBILITY: 0.7,
  AUTO_PROPOSAL_MIN_WEIGHT: 0.5,
  LOW_SIGNAL_ARCHIVE_ONLY: true,
  SOURCE_WEIGHT_DEFAULTS: {
    user_usage: 1.0, market: 0.8, analytics: 0.8,
    community: 0.7, adapter: 0.7, user_comment: 0.3, anonymous: 0.1,
  },
} as const;

/** 判断反馈是否达到自动触发变更提案的阈值 */
export function canAutoPropose(credibility: number, weight: number): boolean {
  return credibility >= FEEDBACK_GOVERNANCE.AUTO_PROPOSAL_MIN_CREDIBILITY
    && weight >= FEEDBACK_GOVERNANCE.AUTO_PROPOSAL_MIN_WEIGHT;
}
