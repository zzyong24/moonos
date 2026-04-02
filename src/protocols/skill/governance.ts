/**
 * Skill Governance — 战略类 Skill 的强制反方约束。
 */
import type { SkillContract } from "./schema.js";

export const SKILL_GOVERNANCE = {
  /** 战略类 category 列表 */
  STRATEGIC_CATEGORIES: ["strategy", "decision", "positioning"] as const,
  /** output_contract 必须包含的 section */
  REQUIRED_OUTPUT_SECTIONS: ["风险与反例"],
  /** evaluation.must_include 必须包含的关键词之一 */
  REQUIRED_EVAL_KEYWORDS: ["边界", "失败条件", "boundary", "failure"],
} as const;

/** 判断 Skill 是否属于战略类 */
export function isStrategicSkill(skill: SkillContract): boolean {
  return (SKILL_GOVERNANCE.STRATEGIC_CATEGORIES as readonly string[]).includes(skill.category);
}

/** 校验战略类 Skill 是否满足反方约束 */
export function validateStrategicSkill(skill: SkillContract): string | null {
  if (!isStrategicSkill(skill)) return null;

  // constraints 中至少有 1 条反方视角
  const hasCounterConstraint = skill.constraints.some(
    (c) => c.includes("反方") || c.includes("风险") || c.includes("counter") || c.includes("risk"),
  );
  if (!hasCounterConstraint) {
    return "战略类 Skill 的 constraints 中至少需要 1 条反方视角要求";
  }

  // output_contract.sections 必须包含风险相关
  const hasRiskSection = skill.output_contract.sections.some(
    (s) => SKILL_GOVERNANCE.REQUIRED_OUTPUT_SECTIONS.some((r) => s.includes(r)),
  );
  if (!hasRiskSection) {
    return `战略类 Skill 的 output_contract.sections 必须包含: ${SKILL_GOVERNANCE.REQUIRED_OUTPUT_SECTIONS.join(", ")}`;
  }

  // evaluation.must_include 必须包含边界/失败条件
  const hasEvalKeyword = skill.evaluation.must_include.some(
    (e) => SKILL_GOVERNANCE.REQUIRED_EVAL_KEYWORDS.some((k) => e.includes(k)),
  );
  if (!hasEvalKeyword) {
    return `战略类 Skill 的 evaluation.must_include 必须包含以下关键词之一: ${SKILL_GOVERNANCE.REQUIRED_EVAL_KEYWORDS.join(", ")}`;
  }

  return null;
}
