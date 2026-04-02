/**
 * Claude × ThirdSpace → MoonOS 资产迁移脚本
 *
 * 把当前 Claude Code + ThirdSpace 生态中的资产导入 MoonOS。
 * 运行方式：npx tsx scripts/import-from-claude.ts
 */
import { MemoryService } from "../src/core/memory/service.js";
import { TraceService } from "../src/core/trace/service.js";
import { initWorkspace, resolveWorkspace } from "../src/core/workspace.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";

const MOONOS_DIR = process.cwd();

async function main() {
  // 确保工作区已初始化
  let ws;
  try {
    ws = await resolveWorkspace(MOONOS_DIR);
  } catch {
    ws = await initWorkspace(MOONOS_DIR);
  }

  const mem = new MemoryService(ws.storage);
  const trace = new TraceService(ws.storage);

  // 开始迁移 trace
  const t = await trace.startTrace("migration_claude_to_moonos");
  await trace.appendEvent(t.trace_id, {
    type: "context_loaded",
    payload: { source: "claude-code + thirdspace + vault", timestamp: new Date().toISOString() },
  });

  let created = 0;
  const errors: string[] = [];

  // ═══════════════════════════════════════════════════════════
  // 1. PROFILE MEMORIES — 用户画像
  // ═══════════════════════════════════════════════════════════

  const profileMemories = [
    {
      title: "MoonlitClear 身份画像",
      summary: "朱志勇(zyongzhu)，腾讯工程师，00后，从技术人转型 AI + 内容创作者",
      content: `本名朱志勇，网名 MoonlitClear（月明水清深）。腾讯 O2 系统软件工程师，00后。
正在从纯技术人转型为 AI + 内容创作者。个人网站 moonlitclear.so。
核心产品线：Lingxi 灵犀（Obsidian 插件）、NoteClear 清记（视频转笔记）、mkd2pic（Markdown 转图片）、ThirdSpace（MCP 服务端 88 工具）、MoonOS（AI 主权控制面）、Vault（Obsidian 知识库）。`,
      tags: ["identity", "profile"],
    },
    {
      title: "写作风格：直白不装、数据驱动",
      summary: "偏长有深度、逻辑严密、数据驱动、从个人经历切入推导普遍洞察，平均 4606 字/篇",
      content: `写作风格特征：
- 语气：偏长但有深度、逻辑严密
- 结构：结构化但灵活，喜欢用表格和清单
- 论据：数据驱动，必须有具体数字/截图/真实经历支撑
- 叙事：平均 4606 字/篇，从个人经历切入推导普遍洞察
- 特殊：不固定套模板，追求自然表达
- 禁止：空洞鸡汤、无数据判断、照搬模板`,
      tags: ["writing", "style"],
    },
    {
      title: "价值观体系",
      summary: "真实经历>理论、行动验证>空谈、系统思维>单点、持续迭代>一步到位、开口收钱>完美产品",
      content: `核心价值排序：
1. 真实经历 > 理论知识
2. 行动验证 > 纸上谈兵
3. 系统思维 > 单点突破
4. 持续迭代 > 一步到位
5. 开口收钱 > 完美产品`,
      tags: ["values", "principles"],
    },
    {
      title: "AI 协作偏好",
      summary: "直白不装、先边界后编码、不做不必要的前言、引用要标注",
      content: `与 AI 协作的行为规则：
- 禁止复制知识库中历史文章的句子或结构，理解后再创作
- 风格要求：直白不装、数据驱动、口语化有结构
- 禁止：空洞鸡汤、无数据判断、照搬模板
- 引用标注：引用原文用「MoonlitClear 在《XX》中提到」显式标注
- 动手前必须先读对应上下文文件，不读不写
- "为什么"比"做了什么"重要，token 比仪式感值钱`,
      tags: ["ai-collaboration", "rules"],
    },
  ];

  for (const p of profileMemories) {
    try {
      await mem.create({ type: "profile", ...p, source: "import", scope: "global", counter_evidence: [] });
      created++;
    } catch (e) { errors.push(`profile: ${p.title} — ${(e as Error).message}`); }
  }

  // ═══════════════════════════════════════════════════════════
  // 2. POLICY MEMORIES — 战略判断
  // ═══════════════════════════════════════════════════════════

  const policyMemories = [
    {
      title: "MoonOS 不做模型专属客户端",
      summary: "MoonOS 的定位是控制面，不因某个模型短期强势就绑死",
      content: "MoonOS 要优先保证可迁移性、可治理性和跨平台适配，不应因为短期模型优势而绑定单一客户端。这是协议设计的根判断。",
      tags: ["moonos", "strategy", "positioning"],
      counter_evidence: ["但有用户反馈：控制面概念太抽象，普通人看不懂具体价值"],
    },
    {
      title: "CLI 优先，不先做 UI",
      summary: "先把协议引擎做对，UI 是后面的事",
      content: "旧版 MoonOS 做了太多 UI 偏离了核心。新版决策：纯后端 + CLI 优先，协议驱动。理由是先让协议和治理规则跑通比好看重要。",
      tags: ["moonos", "strategy", "architecture"],
      counter_evidence: ["但非技术用户完全不会用 CLI，可能限制早期用户获取"],
    },
    {
      title: "主权优先 + 本地优先",
      summary: "数据在用户本地，不在云端；资产属于用户，不属于平台",
      content: "MoonOS 设计原则的第一条和第五条。所有资产存储、协议解析、校验与编排尽量本地优先，云端只承担可选同步与协作增强。这意味着 .moonos/ 目录就是用户的数据主权边界。",
      tags: ["moonos", "principle", "sovereignty"],
      counter_evidence: ["纯本地意味着没有协作能力，团队场景下会成为瓶颈"],
    },
    {
      title: "治理可编码，不靠人记住规则",
      summary: "GovernanceEngine 跑规则，180天到期、反方锚点、月度证伪报告都是代码强制执行",
      content: "MoonOS 的差异化不是写了一套治理文档，而是把治理规则变成 GovernanceEngine 中的代码。记忆到期必须复审（不是建议，是强制）、全局方向型必须有反方锚点（不是提醒，是 warning）、月度证伪报告必须确认（不是可选，是前置条件）。",
      tags: ["moonos", "governance", "principle"],
      counter_evidence: ["过度治理可能让系统变得繁琐，普通用户可能觉得被限制而非被保护"],
    },
    {
      title: "反路径依赖：记忆不默认是真理",
      summary: "任何判断在被验证之前都只是假说，必须能被证伪、被废弃、被外部校准",
      content: "MoonOS 不只是帮用户沉淀资产，也必须防止这些资产固化为系统默认真理。具体机制：Memory 创建后状态是 hypothesis 不是 active；全局方向型最长 180 天；超期自动降级；月度证伪报告强制校准。这是从核心设计宣言 2.3 节来的：主权系统最大的敌人不是平台锁定，而是自我锁定。",
      tags: ["moonos", "anti-lock-in", "philosophy"],
      counter_evidence: ["但用户可能觉得自己明确的偏好（如写作风格）不应该被质疑"],
    },
    {
      title: "先解决痛点再讲世界观",
      summary: "对外叙事顺序：痛点 → 立刻收益 → 第一步入口 → 再介绍协议",
      content: "README 和首页叙事必须从用户当下可感知的痛点切入（换平台重喂、资产带不走、AI黑盒），不能一上来堆 control plane、canonical contract 等术语。小白模式先交付今天就有用的价值，专家模式再逐步打开治理和协议。",
      tags: ["moonos", "narrative", "product"],
      counter_evidence: ["但如果叙事太轻，开发者可能不把 MoonOS 当回事，认为它只是又一个备份工具"],
    },
  ];

  for (const p of policyMemories) {
    try {
      const ce = p.counter_evidence;
      await mem.create({ type: "policy", title: p.title, summary: p.summary, content: p.content, source: "import", scope: "global", tags: p.tags, counter_evidence: ce });
      created++;
    } catch (e) { errors.push(`policy: ${p.title} — ${(e as Error).message}`); }
  }

  // ═══════════════════════════════════════════════════════════
  // 3. CONTEXT MEMORIES — 场景上下文
  // ═══════════════════════════════════════════════════════════

  const contextMemories = [
    {
      title: "写文章场景规则",
      summary: "禁止复制历史文章、理解再创作、不固定模板、从个人经历切入",
      content: `写文章时的强制约束：
1. 禁止复制 crafted/writing/ 或 crafted/voiceover/ 中任何历史文章的句子
2. 阅读参考内容后用理解后的方式重新表达，措辞必须全新
3. 不要每篇文章都用相同结构，根据内容灵活调整
4. 风格一致：直白、口语化、有数据支撑、从个人经历切入
必读：最近 3 篇文章（理解语感）+ 最近 2 篇反思（了解思考方向）`,
      tags: ["writing", "context", "rules"],
    },
    {
      title: "做决策场景规则",
      summary: "基于数据非假设、不照搬历史建议、诚实面对不确定、一次只给一个核心建议",
      content: `出谋划策 / 诊断分析时的强制约束：
1. 基于数据而非假设：所有建议必须有数据支撑
2. 不照搬历史建议：基于最新数据重新判断
3. 诚实面对不确定性：不确定直说，不编造逻辑链
4. 一次只给一个核心建议：不要列一堆待办
必读：最新创作数据 + 最近反思 + 商业构想`,
      tags: ["strategy", "context", "rules"],
    },
    {
      title: "Session 启动：四层优先级扫描",
      summary: "外部阻塞 > 关键路径缺口 > 限时验证窗口 > 周焦点",
      content: `无任务时的主动模式优先级扫描：
1. 外部阻塞项：被打回的 PR、等审核、等回复（有时间窗口）
2. 关键路径缺口：主力产品 roadmap 的下一个卡点
3. 限时验证窗口：product-status.md 黄灯区域，快到期的
4. 周焦点：todos.md 本周焦点，按截止日期排
规则：同层选做完能闭环的；跨层高压低；只关注绿灯黄灯产品，忽略红灯暂停的`,
      tags: ["workflow", "session", "priority"],
    },
    {
      title: "工作日志规则",
      summary: "一件事完整收尾后写，为什么做比做了什么重要",
      content: `工作日志触发规则：
- 触发：一件事完整收尾后写（代码改完、方案写完），中间过程不写
- 格式：HH:MM 标题 → 为什么做 → 怎么做的 → 改了什么
- 规则：一次 session 可能写 0 条或多条；"为什么"比"做了什么"重要；token 比仪式感值钱`,
      tags: ["worklog", "context", "rules"],
    },
    {
      title: "能力封装规则",
      summary: "同类多步操作出现 2 次以上建议封装 MCP 工具，纯文本生成不做工具",
      content: "同类多步操作出现 2 次以上 → 建议封装 MCP 工具（等用户确认）。纯文本生成/一次性操作 → 不做工具。这是 ThirdSpace 88 个工具的演化路径。",
      tags: ["mcp", "tooling", "rules"],
    },
  ];

  for (const c of contextMemories) {
    try {
      await mem.create({ type: "context", ...c, source: "import", scope: "global", counter_evidence: [] });
      created++;
    } catch (e) { errors.push(`context: ${c.title} — ${(e as Error).message}`); }
  }

  // ═══════════════════════════════════════════════════════════
  // 4. EXPERIENCE MEMORIES — 实践经验
  // ═══════════════════════════════════════════════════════════

  const experienceMemories = [
    {
      title: "MoonOS v1 的教训：UI 做太多偏离核心",
      summary: "旧版 MoonOS 做了 Next.js 全栈 + 6 个页面的工作流 IDE，但偏离了核心——协议引擎才是价值",
      content: "旧版 moonos/ 在 moon monorepo 里，是 Next.js 16 全栈项目，做了 pipeline IDE、flow 拓扑、knowledge 浏览器等 6 个页面。最实的产出是 moonos-protocols.ts（1874 行 Zod schema）。教训：先把协议和治理做对，UI 是后面的事。v2 决策：完全独立仓库、TypeScript 纯后端、CLI 优先。",
      tags: ["moonos", "postmortem", "lesson"],
    },
    {
      title: "ThirdSpace 88 工具的演化路径",
      summary: "从 0 到 88 个 MCP 工具，核心经验是需求驱动 + 同类操作 2 次以上才封装",
      content: "ThirdSpace 目前有 88 个 MCP 工具，分布在 26 个 Python 模块中。分类：infrastructure(行动/AI上下文/工作日志)、creation(文章/创作追踪/视频/mkd2pic)、knowledge(知识引擎/项目文档/迭代实践)、reflection(深度反思/生活OS/周报月报)、business(角色引擎 20 工具)、automation(飞书/自动驾驶)。关键经验：不预先设计，用 2 次以上再封装。",
      tags: ["thirdspace", "mcp", "tooling"],
    },
    {
      title: "Vault 知识库的组织方式",
      summary: "295 个 md 文件、16 个 topic、7 必填 frontmatter 字段、ItemManager 守门写入",
      content: "Vault 是 Obsidian 管理的纯 Markdown 知识库。结构：found/(外部采集) + crafted/(自创内容) + flux/(临时中转)。所有文件 frontmatter 必须有 7 个字段(type/topic/created/modified/tags/origin/source)。写入只走 ThirdSpace ItemManager，保证规范。三件套架构：Vault(大脑) ← ThirdSpace(四肢) ← MoonOS(神经)。",
      tags: ["vault", "knowledge", "architecture"],
    },
    {
      title: "首笔产品收入 ¥18.8",
      summary: "Lingxi 灵犀 Obsidian 插件的第一笔付费用户",
      content: "2026 年 Q1 拿到首笔产品收入 ¥18.8，来自 Lingxi 灵犀（Obsidian Heatmap Calendar 插件）。意义不在金额，在于验证了「开口收钱 > 完美产品」这条价值观。Q2 目标：¥500+/月，20 个付费用户。",
      tags: ["revenue", "milestone", "lingxi"],
    },
  ];

  for (const e of experienceMemories) {
    try {
      await mem.create({ type: "experience", ...e, source: "import", scope: "global", counter_evidence: [] });
      created++;
    } catch (e2) { errors.push(`experience: ${e.title} — ${(e2 as Error).message}`); }
  }

  // ═══════════════════════════════════════════════════════════
  // 5. 完成 Trace
  // ═══════════════════════════════════════════════════════════

  await trace.appendEvent(t.trace_id, {
    type: "output_saved",
    payload: { created, errors: errors.length, source: "claude-code + thirdspace + vault" },
  });

  await trace.finalize(t.trace_id, errors.length > 0 ? "partial" : "success", {
    lessons: [
      "资产从 CLAUDE.md + profile.md + scene-context + skill-registry 四个来源提取",
      "policy 类记忆全部带了 counter_evidence，这是 MoonOS 治理的核心要求",
      "ThirdSpace 的 88 个 MCP 工具可以后续逐条映射为 Skill Contract",
    ],
    counterfactuals: [
      "如果 MoonOS 有 API server，这个迁移可以做成 Web 界面的一键导入",
    ],
  });

  // ═══════════════════════════════════════════════════════════
  // 6. 输出结果
  // ═══════════════════════════════════════════════════════════

  console.log(`\n✓ Migration complete`);
  console.log(`  Created: ${created} memories`);
  console.log(`  Profile: ${profileMemories.length}`);
  console.log(`  Policy: ${policyMemories.length} (all with counter-evidence)`);
  console.log(`  Context: ${contextMemories.length}`);
  console.log(`  Experience: ${experienceMemories.length}`);
  console.log(`  Trace: ${t.trace_id}`);

  if (errors.length > 0) {
    console.log(`\n⚠ ${errors.length} errors:`);
    for (const e of errors) console.log(`  ${e}`);
  }

  console.log(`\nNext steps:`);
  console.log(`  moonos memory list`);
  console.log(`  moonos memory stats`);
  console.log(`  moonos memory activate <id>  # 逐条激活你认为已验证的记忆`);
}

main().catch((e) => { console.error(e); process.exit(1); });
