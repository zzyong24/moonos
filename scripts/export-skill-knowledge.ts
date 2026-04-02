/**
 * 导出 ThirdSpace 知识引擎 → MoonOS Skill Contract + Implementation + Workflow
 *
 * 运行：npx tsx scripts/export-skill-knowledge.ts
 */
import { SkillService } from "../src/core/skill/service.js";
import { MemoryService } from "../src/core/memory/service.js";
import { TraceService } from "../src/core/trace/service.js";
import { resolveWorkspace, initWorkspace } from "../src/core/workspace.js";
import { CURRENT_PROTOCOL_VERSION } from "../src/protocols/_shared/base.js";

const MOONOS_DIR = process.cwd();

async function main() {
  let ws;
  try {
    ws = await resolveWorkspace(MOONOS_DIR);
  } catch {
    ws = await initWorkspace(MOONOS_DIR);
  }

  const skillService = new SkillService(ws.storage);
  const memService = new MemoryService(ws.storage);
  const traceService = new TraceService(ws.storage);

  // 开始 trace
  const t = await traceService.startTrace("export_skill_knowledge_engine");

  // ═══════════════════════════════════════════════════════════
  // 1. Skill Contract — 知识引擎的能力契约
  // ═══════════════════════════════════════════════════════════

  const contract = await skillService.createContract({
    name: "知识引擎",
    description: "网页/飞书/视频内容采集 → 知识卡片/学习文档。完整的知识输入管线：从 URL 到结构化知识资产。",
    category: "knowledge",
    triggers: ["收集", "知识卡片", "学习文档", "抓取", "笔记", "网页收集", "collect", "knowledge card"],
    input_contract: {
      url: "string",
      topic: "string",
    },
    output_contract: {
      type: "markdown",
      sections: ["摘要", "关键要点", "深度思考问题", "来源标注"],
    },
    constraints: [
      "输入必须是有效 URL 或已有的原文文件路径",
      "生成的知识卡片必须包含 thinking_questions（深度思考问题），不能只做摘要",
      "必须保留原文来源信息（url, author, site_name）",
      "tags 必须从内容中提取，不能凭空编造",
    ],
    evaluation: {
      must_include: ["关键要点不少于3条", "思考问题至少2个"],
      anti_patterns: ["只复制原文不做提炼", "思考问题过于宽泛没有针对性"],
    },
  });

  console.log(`✓ Skill Contract created: ${contract.id}`);
  console.log(`  Name: ${contract.name}`);

  // ═══════════════════════════════════════════════════════════
  // 2. Skill Implementation — ThirdSpace MCP 实现
  // ═══════════════════════════════════════════════════════════

  const impl = await skillService.createImplementation({
    contract_id: contract.id,
    target: "thirdspace-mcp",
    prompts: [
      { name: "knowledge-card", path: "skills/knowledge/prompts/knowledge-card.md" },
      { name: "study-doc", path: "skills/knowledge/prompts/study-doc.md" },
    ],
    tools: [
      { name: "add_note", required: false },
      { name: "collect_content", required: true },
      { name: "save_knowledge_card", required: true },
      { name: "collect_study", required: false },
      { name: "save_study_doc", required: false },
    ],
    runtime_policy: {
      approval: "optional",
      max_tool_calls: 8,
    },
    compatibility: {
      version: CURRENT_PROTOCOL_VERSION,
      adapter: "thirdspace",
    },
  });

  console.log(`✓ Skill Implementation created: ${impl.id}`);
  console.log(`  Target: ${impl.target}`);
  console.log(`  Tools: ${impl.tools.map((t) => t.name).join(", ")}`);

  // ═══════════════════════════════════════════════════════════
  // 3. Workflow — 知识采集到知识卡片的标准流程
  // ═══════════════════════════════════════════════════════════

  const workflow = {
    id: `wf_${Date.now()}`,
    name: "知识采集 → 知识卡片",
    version: CURRENT_PROTOCOL_VERSION,
    workflow_class: "exploit" as const,
    nodes: [
      {
        id: "collect",
        type: "tool" as const,
        tool: "collect_content",
        input_contract: { url: "string" },
        output_contract: { raw_abs_path: "string", content_preview: "string" },
      },
      {
        id: "reason",
        type: "agent" as const,
        agent_role: "reader",
        input_contract: { raw_abs_path: "string" },
        output_contract: { summary: "string", key_points: "array", thinking_questions: "array" },
      },
      {
        id: "save",
        type: "tool" as const,
        tool: "save_knowledge_card",
        input_contract: { title: "string", summary: "string", key_points: "array" },
        output_contract: { path: "string" },
        resolve_policy: {
          mode: "inherit" as const,
          allowed_strategies: ["direct" as const, "schema-match" as const, "vault-place" as const],
          disable_llm: true,
          required_manual_fields: ["title"],
        },
      },
    ],
    edges: [
      { from: "collect", to: "reason" },
      { from: "reason", to: "save" },
    ],
    resolver_policy: {
      enabled: true,
      strategy_order: ["direct" as const, "schema-match" as const, "vault-place" as const, "llm" as const],
      llm_fallback: "fallback-only" as const,
      record_reasoning: false,
      record_trace_core: true as const,
      replay_prefers_trace_params: true as const,
      allow_vault_place_for_save_tools: true,
    },
    policy: {
      retry: 1,
      approval: "optional" as const,
      trace_level: "standard" as const,
    },
  };

  await ws.storage.create("workflow", { ...workflow, updated_at: new Date().toISOString() });

  console.log(`✓ Workflow created: ${workflow.id}`);
  console.log(`  Name: ${workflow.name}`);
  console.log(`  Nodes: ${workflow.nodes.map((n) => n.id).join(" → ")}`);

  // ═══════════════════════════════════════════════════════════
  // 4. Experience Memory — 关于这个 Skill 的使用经验
  // ═══════════════════════════════════════════════════════════

  await memService.create({
    type: "experience",
    title: "知识引擎是最常用的 Skill",
    summary: "collect_content → AI 生成知识卡片 → save_knowledge_card 是日常最高频的工作流",
    content: `知识引擎（knowledge）是 ThirdSpace 88 个工具中使用频率最高的 skill。
典型流程：给一个 URL → collect_content 抓取 → AI 生成摘要+关键要点+思考问题 → save_knowledge_card 写入 Vault。
关键经验：
1. thinking_questions 的质量决定了知识卡片的长期价值——不能只做摘要
2. tags 必须从内容中提取，不能凭空编造
3. 飞书文档和普通网页走不同的采集路径（collect_content 内部处理）
4. 学习文档（collect_study → save_study_doc）适合播客/访谈等高密度内容，比知识卡片更详细`,
    source: "import",
    scope: "global",
    tags: ["knowledge", "skill", "workflow", "thirdspace"],
    counter_evidence: [],
  });

  console.log(`✓ Experience memory created`);

  // ═══════════════════════════════════════════════════════════
  // 5. 完成 Trace
  // ═══════════════════════════════════════════════════════════

  await traceService.appendEvent(t.trace_id, {
    type: "skill_selected",
    payload: { skill: "knowledge", contract_id: contract.id, impl_id: impl.id },
  });
  await traceService.appendEvent(t.trace_id, {
    type: "output_saved",
    payload: { contract: contract.id, implementation: impl.id, workflow: workflow.id },
  });
  await traceService.finalize(t.trace_id, "success", {
    lessons: [
      "ThirdSpace skill-registry.json 可以映射为 MoonOS 的 Contract + Implementation 双层结构",
      "Workflow 的 3 节点模式（collect → reason → save）可以复用到其他采集类 skill",
    ],
  });

  // ═══════════════════════════════════════════════════════════
  // 6. 汇总
  // ═══════════════════════════════════════════════════════════

  console.log(`\n════════════════════════════════════════`);
  console.log(`✓ Knowledge Skill exported to MoonOS`);
  console.log(`  Contract:       ${contract.id} (${contract.name})`);
  console.log(`  Implementation: ${impl.id} (target: ${impl.target})`);
  console.log(`  Workflow:       ${workflow.id} (${workflow.name})`);
  console.log(`  Trace:          ${t.trace_id}`);
  console.log(`════════════════════════════════════════`);
  console.log(`\nVerify:`);
  console.log(`  moonos memory list -t experience`);
  console.log(`  moonos protocols show skill-contract`);
  console.log(`  moonos export -o moonos-with-skills.json`);
}

main().catch((e) => { console.error(e); process.exit(1); });
