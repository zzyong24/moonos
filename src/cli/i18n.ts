import { ZodError } from "zod";
import { MoonOSError } from "../core/errors.js";
import {
  GovernanceViolationError,
  type GovernanceViolation,
} from "../core/governance/engine.js";

export type CliLocale = "en" | "zh-CN";

type MessageCatalog = Record<string, string>;

const DEFAULT_LOCALE: CliLocale = "en";
let currentLocale: CliLocale = DEFAULT_LOCALE;

const MESSAGE_CATALOG: Record<CliLocale, MessageCatalog> = {
  en: {
    "cli.description": "MoonOS — AI Sovereignty Control Plane",
    "cli.option.lang": "CLI language: en|zh-CN",

    "common.outputJson": "Output as JSON",
    "common.errorPrefix": "Error",
    "common.unknownError": "Unknown error",
    "common.na": "N/A",
    "common.none": "—",

    "init.description": "Initialize a new MoonOS workspace in the current directory",
    "init.option.dir": "Target directory",
    "init.success": "✓ MoonOS workspace initialized at {path}",
    "init.nextSteps": "Next steps:",
    "init.nextStepCreate": "moonos memory create -t profile --title '...' --content '...'",
    "init.nextStepStatus": "moonos status",

    "status.description": "Show workspace status",
    "status.workspace": "MoonOS Workspace",
    "status.protocolVersion": "Protocol Version",
    "status.totalAssets": "Total Assets",
    "status.collectionLine": "  {name}: {count} items (last: {lastModified})",
    "status.emptyWorkspace": "  (empty workspace)",
    "status.getStarted": "Get started:",
    "status.getStartedCommand": "moonos memory create -t profile --title 'My preference' --content '...'",

    "briefing.description": "AI startup briefing — minimal tokens, maximum context",

    "memory.command.description": "Manage memory assets",

    "memory.create.description": "Create a new memory item (status: hypothesis)",
    "memory.create.option.type": "Memory type: profile|context|experience|policy",
    "memory.create.option.title": "Memory title",
    "memory.create.option.content": "Memory content",
    "memory.create.option.summary": "Summary (defaults to first 100 chars of content)",
    "memory.create.option.source": "Source: vault|import|agent|manual|external_feedback",
    "memory.create.option.scope": "Scope: global|product|project|session",
    "memory.create.option.product": "Product name",
    "memory.create.option.confidence": "Confidence 0-1",
    "memory.create.option.tags": "Comma-separated tags",
    "memory.create.success": "✓ Memory created: {id}",
    "memory.create.meta": "  Type: {type} | Status: {status} | Scope: {scope}",
    "memory.create.title": "  Title: {title}",
    "memory.create.expires": "  Expires: {expiresAt}",

    "memory.list.description": "List memory items",
    "memory.list.option.type": "Filter by type",
    "memory.list.option.status": "Filter by status",
    "memory.list.option.limit": "Max results",
    "memory.list.none": "No memory items found.",
    "memory.list.header.id": "ID",
    "memory.list.header.type": "Type",
    "memory.list.header.status": "Status",
    "memory.list.header.title": "Title",
    "memory.list.header.confidence": "Conf",
    "memory.list.header.expires": "Expires",
    "memory.list.total": "Total: {count} items",

    "memory.get.description": "Get a memory item by ID",
    "memory.get.id": "ID",
    "memory.get.type": "Type",
    "memory.get.status": "Status",
    "memory.get.title": "Title",
    "memory.get.summary": "Summary",
    "memory.get.content": "Content",
    "memory.get.sourceScope": "Source: {source} | Scope: {scope}",
    "memory.get.confidence": "Confidence",
    "memory.get.tags": "Tags",
    "memory.get.expires": "Expires",
    "memory.get.counterEvidence": "Counter Evidence",
    "memory.get.review": "Review",
    "memory.get.lastOutcome": "Last outcome",
    "memory.get.created": "Created",
    "memory.get.updated": "Updated",

    "memory.activate.description": "Activate a hypothesis memory → active",
    "memory.activate.option.notes": "Activation notes",
    "memory.activate.success": "✓ Memory activated: {id}",
    "memory.activate.status": "  Status: {status}",
    "memory.activate.expires": "  Expires: {expiresAt}",

    "memory.review.description": "Review a memory item",
    "memory.review.option.decision": "Decision: confirm|delay|deprecate|falsify",
    "memory.review.option.notes": "Review notes",
    "memory.review.success": "✓ Memory reviewed: {id}",
    "memory.review.decision": "  Decision: {decision}",
    "memory.review.status": "  Status: {status} | Review: {reviewState}",
    "memory.review.expires": "  Expires: {expiresAt}",

    "memory.batchReview.description": "Batch review all expired memories",
    "memory.batchReview.option.action": "Apply to all: confirm|delay",
    "memory.batchReview.option.notes": "Notes for all items",
    "memory.batchReview.none": "✓ No memories need review right now.",
    "memory.batchReview.completed": "✓ Batch review completed:",
    "memory.batchReview.processed": "  Processed: {count}",
    "memory.batchReview.confirmed": "  Confirmed: {count}",
    "memory.batchReview.delayed": "  Delayed:   {count}",
    "memory.batchReview.skipped": "  Skipped:   {count}",

    "memory.autoDowngrade.description": "Automatically downgrade memories past grace period (active → hypothesis)",
    "memory.autoDowngrade.none": "✓ No memories need downgrading.",
    "memory.autoDowngrade.header": "⚠ Downgraded {count} memories (active → hypothesis):",
    "memory.autoDowngrade.item": "  {id}: {title}",

    "memory.needsReview.description": "List memories that need review (expired active memories)",
    "memory.needsReview.none": "✓ No memories need review.",
    "memory.needsReview.heading": "{count} memories need review:",
    "memory.needsReview.header.id": "ID",
    "memory.needsReview.header.type": "Type",
    "memory.needsReview.header.title": "Title",
    "memory.needsReview.header.expiredSince": "Expired Since",

    "memory.addCounterEvidence.description": "Add counter-evidence to a memory",
    "memory.addCounterEvidence.option.text": "Counter-evidence description",
    "memory.addCounterEvidence.success": "✓ Counter-evidence added to {id}",
    "memory.addCounterEvidence.total": "  Total counter-evidence: {count}",

    "memory.stats.description": "Show memory governance statistics",
    "memory.stats.title": "Memory Governance Dashboard",
    "memory.stats.byStatus": "By Status:",
    "memory.stats.byType": "By Type:",
    "memory.stats.total": "Total: {count}",
    "memory.stats.expiringSoon": "⚡ Expiring soon (in reminder window): {count}",
    "memory.stats.overdue": "⚠ Overdue (in grace period): {count}",
    "memory.stats.needsDowngrade": "🔴 Needs auto-downgrade: {count}",
    "memory.stats.healthy": "✓ All memories healthy.",

    "protocols.command.description": "Browse MoonOS protocol definitions",
    "protocols.list.description": "List all protocols and supporting objects",
    "protocols.list.title": "MoonOS Protocol Catalog v{version}",
    "protocols.list.protocols": "Protocols:",
    "protocols.list.supporting": "Supporting Objects:",
    "protocols.list.header.id": "ID",
    "protocols.list.header.name": "Name",
    "protocols.list.header.version": "Version",
    "protocols.list.header.requiredFields": "Required Fields",
    "protocols.show.description": "Show protocol JSON Schema",
    "protocols.show.unknown": "Unknown protocol: {id}",
    "protocols.show.available": "Available: {ids}",

    "export.description": "Export workspace assets to a bundle file",
    "export.option.output": "Output file path",
    "export.option.collections": "Comma-separated collections to export",
    "export.success": "✓ Exported {count} assets to {path}",
    "export.bundleId": "  Bundle ID: {bundleId}",
    "export.protocolVersion": "  Protocol Version: {version}",
    "export.collectionCount": "  {collection}: {count}",

    "import.description": "Import assets from a bundle file",
    "import.option.policy": "Conflict resolution: user_confirm|overwrite|skip|newer_first|keep_both",
    "import.readingBundle": "Reading bundle: {bundleId} ({count} assets)",
    "import.completed": "✓ Import {status}",
    "import.status.completed": "completed",
    "import.status.completed_with_conflicts": "completed_with_conflicts",
    "import.status.failed": "failed",
    "import.summary": "  Total: {total} | Imported: {imported} | Skipped: {skipped} | Overwritten: {overwritten}",
    "import.conflicts": "⚠ {count} conflicts detected:",
    "import.header.assetId": "Asset ID",
    "import.header.type": "Type",
    "import.header.conflictingFields": "Conflicting Fields",
    "import.conflictsHint": "Conflicting assets were skipped. Use --policy overwrite|newer_first|keep_both to handle them.",
    "import.errors": "❌ {count} errors:",

    "trace.command.description": "Manage execution traces",
    "trace.start.description": "Start a new trace session",
    "trace.start.option.session": "Session ID",
    "trace.start.option.workflow": "Workflow ID",
    "trace.start.success": "✓ Trace started: {traceId}",
    "trace.start.session": "  Session: {sessionId}",
    "trace.start.workflow": "  Workflow: {workflowId}",

    "trace.event.description": "Append an event to a trace",
    "trace.event.option.type": "Event type (e.g. tool_called, error_raised)",
    "trace.event.option.node": "Node ID",
    "trace.event.option.payload": "JSON payload",
    "trace.event.success": "✓ Event appended to {traceId}: {eventType} ({count} events total)",

    "trace.finalize.description": "Finalize a trace with status and lessons",
    "trace.finalize.option.status": "Final status: success|failed|falsified",
    "trace.finalize.option.lesson": "Add a lesson (repeatable)",
    "trace.finalize.option.counterfactual": "Add a counterfactual (repeatable)",
    "trace.finalize.success": "✓ Trace finalized: {traceId}",
    "trace.finalize.status": "  Status: {status}",
    "trace.finalize.events": "  Events: {count}",
    "trace.finalize.lessons": "  Lessons: {count}",
    "trace.finalize.counterfactuals": "  Counterfactuals: {count}",

    "trace.list.description": "List traces",
    "trace.list.option.status": "Filter by status",
    "trace.list.option.limit": "Max results",
    "trace.list.none": "No traces found.",
    "trace.list.header.traceId": "Trace ID",
    "trace.list.header.session": "Session",
    "trace.list.header.status": "Status",
    "trace.list.header.events": "Events",
    "trace.list.header.lessons": "Lessons",
    "trace.list.total": "Total: {count} traces",

    "trace.get.description": "Get trace details",
    "trace.get.option.summary": "Show summary instead of full trace",
    "trace.get.summary.trace": "Trace: {traceId}",
    "trace.get.summary.statusEvents": "Status: {status} | Events: {count}",
    "trace.get.summary.groups": "Groups: {groups}",
    "trace.get.summary.containsFailures": "⚠ Contains failures",
    "trace.get.summary.containsFalsifications": "⚠ Contains falsifications",
    "trace.get.summary.lessons": "Lessons: {count}",
    "trace.get.detail.traceId": "Trace ID",
    "trace.get.detail.session": "Session",
    "trace.get.detail.workflow": "Workflow",
    "trace.get.detail.status": "Status",
    "trace.get.detail.events": "Events ({count})",
    "trace.get.detail.lessons": "Lessons:",
    "trace.get.detail.counterfactuals": "Counterfactuals:",

    "trace.falsified.description": "Extract all falsified hypotheses from traces",
    "trace.falsified.option.limit": "Max traces to scan",
    "trace.falsified.none": "No falsified hypotheses found.",
    "trace.falsified.heading": "Found {count} falsified hypotheses:",
    "trace.falsified.evidence": "Evidence: {evidence}",
    "trace.falsified.time": "Time: {time}",

    "report.command.description": "Generate and manage governance reports",
    "report.generate.description": "Generate monthly falsification report (YYYY-MM)",
    "report.generate.success": "✓ Falsification Report generated: {reportId}",
    "report.generate.month": "  Month: {month}",
    "report.generate.judgments": "  Judgments: {count}",
    "report.generate.highImpact": "  High Impact: {count}",
    "report.generate.frozenMemories": "  Frozen Memories: {count}",
    "report.generate.hash": "  Hash: {hash}",
    "report.generate.actions": "Actions taken:",
    "report.generate.actionFrozenMemory": "Frozen memory: {id}",
    "report.generate.actionSaved": "Report saved: {id}",
    "report.generate.none": "✓ No falsified judgments this month.",

    "import.error.unknownAssetType": "Unknown asset type: {type} ({id})",
    "import.error.failedToImport": "Failed to import {id}: {reason}",

    "report.show.description": "Show a falsification report (YYYY-MM)",

    "report.show.title": "Falsification Report: {month}",
    "report.show.generated": "Generated: {generatedAt}",
    "report.show.hash": "Hash: {hash}",
    "report.show.acknowledged": "Acknowledged: {value}",
    "report.show.notYet": "NOT YET",
    "report.show.summary": "Summary:",
    "report.show.judgments": "Judgments:",
    "report.show.sourceEvidence": "Source: {source} | Evidence: {evidence}",
    "report.show.actions": "Actions: {actions}",

    "report.acknowledge.description": "Acknowledge a falsification report (required before core use)",
    "report.acknowledge.success": "✓ Report {month} acknowledged at {timestamp}",

    "report.list.description": "List all falsification reports",
    "report.list.none": "No reports generated yet.",
    "report.list.unacknowledged": "⚠ UNACKNOWLEDGED",
    "report.list.line": "  {month} | Judgments: {judgments} | High: {high} | {ack}",

    "error.workspace.notFound": "MoonOS workspace not found (.moonos/ directory).\nRun `moonos init` first.",
    "error.memory.notFound": "Memory not found: {id}",
    "error.memory.unknownReviewDecision": "Unknown review decision: {decision}",
    "error.trace.notFound": "Trace not found: {id}",
    "error.report.notFound": "Report not found: {month}",
    "error.storage.itemAlreadyExists": "Item already exists: {collection}/{id}",
    "error.storage.itemNotFound": "Item not found: {collection}/{id}",
    "error.protocol.invalidSemver": "Invalid semver: {version}",

    "validation.semver": "Version must match major.minor.patch",
    "validation.semverSelector": "Version selector must match major.minor.patch or major.minor.x",
    "validation.sha256": "Hash must match sha256:<64 hex chars>",
    "validation.yearMonth": "Month must match YYYY-MM",
    "validation.expiresAfterCreatedAt": "expires_at must be later than created_at",

    "governance.memory.globalDirectional.missingExpiresAt": "Global directional memory must set expires_at",
    "governance.memory.globalDirectional.expiryTooLong": "Global directional memory expiry must not exceed {maxDays} days",
    "governance.memory.counterEvidenceRequired": "Global directional memories should add at least one counter-evidence before activation",
    "governance.memory.invalidTransition": "Invalid lifecycle transition: {current} → {target}",
    "governance.memory.lowConfidence": "Memory confidence is only {confidence}; collect more evidence before activation",
  },
  "zh-CN": {
    "cli.description": "MoonOS — AI 主权控制面",
    "cli.option.lang": "CLI 语言：en|zh-CN",

    "common.outputJson": "以 JSON 输出",
    "common.errorPrefix": "错误",
    "common.unknownError": "未知错误",
    "common.na": "无",
    "common.none": "—",

    "init.description": "在当前目录初始化一个新的 MoonOS 工作区",
    "init.option.dir": "目标目录",
    "init.success": "✓ 已在 {path} 初始化 MoonOS 工作区",
    "init.nextSteps": "下一步：",
    "init.nextStepCreate": "moonos memory create -t profile --title '...' --content '...'",
    "init.nextStepStatus": "moonos status",

    "status.description": "查看工作区状态",
    "status.workspace": "MoonOS 工作区",
    "status.protocolVersion": "协议版本",
    "status.totalAssets": "资产总数",
    "status.collectionLine": "  {name}: {count} 条（最近更新：{lastModified}）",
    "status.emptyWorkspace": "  （空工作区）",
    "status.getStarted": "开始使用：",
    "status.getStartedCommand": "moonos memory create -t profile --title '我的偏好' --content '...'",

    "briefing.description": "AI 启动简报——尽量少 token，尽量多上下文",

    "memory.command.description": "管理记忆资产",

    "memory.create.description": "创建一条新记忆（状态：hypothesis）",
    "memory.create.option.type": "记忆类型：profile|context|experience|policy",
    "memory.create.option.title": "记忆标题",
    "memory.create.option.content": "记忆内容",
    "memory.create.option.summary": "摘要（默认取内容前 100 个字符）",
    "memory.create.option.source": "来源：vault|import|agent|manual|external_feedback",
    "memory.create.option.scope": "作用域：global|product|project|session",
    "memory.create.option.product": "产品名",
    "memory.create.option.confidence": "置信度 0-1",
    "memory.create.option.tags": "逗号分隔标签",
    "memory.create.success": "✓ 已创建记忆：{id}",
    "memory.create.meta": "  类型：{type} | 状态：{status} | 范围：{scope}",
    "memory.create.title": "  标题：{title}",
    "memory.create.expires": "  到期时间：{expiresAt}",

    "memory.list.description": "列出记忆",
    "memory.list.option.type": "按类型筛选",
    "memory.list.option.status": "按状态筛选",
    "memory.list.option.limit": "最大返回数量",
    "memory.list.none": "没有找到记忆。",
    "memory.list.header.id": "ID",
    "memory.list.header.type": "类型",
    "memory.list.header.status": "状态",
    "memory.list.header.title": "标题",
    "memory.list.header.confidence": "置信度",
    "memory.list.header.expires": "到期",
    "memory.list.total": "总计：{count} 条",

    "memory.get.description": "按 ID 查看记忆",
    "memory.get.id": "ID",
    "memory.get.type": "类型",
    "memory.get.status": "状态",
    "memory.get.title": "标题",
    "memory.get.summary": "摘要",
    "memory.get.content": "内容",
    "memory.get.sourceScope": "来源：{source} | 范围：{scope}",
    "memory.get.confidence": "置信度",
    "memory.get.tags": "标签",
    "memory.get.expires": "到期时间",
    "memory.get.counterEvidence": "反方锚点",
    "memory.get.review": "复审",
    "memory.get.lastOutcome": "最近结果",
    "memory.get.created": "创建时间",
    "memory.get.updated": "更新时间",

    "memory.activate.description": "将一条 hypothesis 记忆激活为 active",
    "memory.activate.option.notes": "激活备注",
    "memory.activate.success": "✓ 已激活记忆：{id}",
    "memory.activate.status": "  状态：{status}",
    "memory.activate.expires": "  到期时间：{expiresAt}",

    "memory.review.description": "复审一条记忆",
    "memory.review.option.decision": "决策：confirm|delay|deprecate|falsify",
    "memory.review.option.notes": "复审备注",
    "memory.review.success": "✓ 已复审记忆：{id}",
    "memory.review.decision": "  决策：{decision}",
    "memory.review.status": "  状态：{status} | 复审：{reviewState}",
    "memory.review.expires": "  到期时间：{expiresAt}",

    "memory.batchReview.description": "批量复审所有已过期记忆",
    "memory.batchReview.option.action": "统一应用：confirm|delay",
    "memory.batchReview.option.notes": "统一备注",
    "memory.batchReview.none": "✓ 当前没有需要复审的记忆。",
    "memory.batchReview.completed": "✓ 批量复审已完成：",
    "memory.batchReview.processed": "  已处理：{count}",
    "memory.batchReview.confirmed": "  已确认：{count}",
    "memory.batchReview.delayed": "  已延期：{count}",
    "memory.batchReview.skipped": "  已跳过：{count}",

    "memory.autoDowngrade.description": "自动降级超过 grace period 的记忆（active → hypothesis）",
    "memory.autoDowngrade.none": "✓ 没有需要降级的记忆。",
    "memory.autoDowngrade.header": "⚠ 已降级 {count} 条记忆（active → hypothesis）：",
    "memory.autoDowngrade.item": "  {id}: {title}",

    "memory.needsReview.description": "列出需要复审的记忆（已过期的 active 记忆）",
    "memory.needsReview.none": "✓ 没有需要复审的记忆。",
    "memory.needsReview.heading": "有 {count} 条记忆需要复审：",
    "memory.needsReview.header.id": "ID",
    "memory.needsReview.header.type": "类型",
    "memory.needsReview.header.title": "标题",
    "memory.needsReview.header.expiredSince": "过期时间",

    "memory.addCounterEvidence.description": "为记忆添加反方锚点",
    "memory.addCounterEvidence.option.text": "反方锚点描述",
    "memory.addCounterEvidence.success": "✓ 已为 {id} 添加反方锚点",
    "memory.addCounterEvidence.total": "  反方锚点总数：{count}",

    "memory.stats.description": "查看记忆治理统计",
    "memory.stats.title": "记忆治理仪表盘",
    "memory.stats.byStatus": "按状态：",
    "memory.stats.byType": "按类型：",
    "memory.stats.total": "总计：{count}",
    "memory.stats.expiringSoon": "⚡ 即将到期（提醒窗口内）：{count}",
    "memory.stats.overdue": "⚠ 已过期（仍在 grace period 内）：{count}",
    "memory.stats.needsDowngrade": "🔴 需要自动降级：{count}",
    "memory.stats.healthy": "✓ 所有记忆状态健康。",

    "protocols.command.description": "浏览 MoonOS 协议定义",
    "protocols.list.description": "列出所有协议和 supporting object",
    "protocols.list.title": "MoonOS 协议目录 v{version}",
    "protocols.list.protocols": "协议：",
    "protocols.list.supporting": "Supporting Objects：",
    "protocols.list.header.id": "ID",
    "protocols.list.header.name": "名称",
    "protocols.list.header.version": "版本",
    "protocols.list.header.requiredFields": "必填字段数",
    "protocols.show.description": "查看协议 JSON Schema",
    "protocols.show.unknown": "未知协议：{id}",
    "protocols.show.available": "可用项：{ids}",

    "export.description": "将工作区资产导出为 bundle 文件",
    "export.option.output": "输出文件路径",
    "export.option.collections": "要导出的 collection（逗号分隔）",
    "export.success": "✓ 已导出 {count} 个资产到 {path}",
    "export.bundleId": "  Bundle ID：{bundleId}",
    "export.protocolVersion": "  协议版本：{version}",
    "export.collectionCount": "  {collection}: {count}",

    "import.description": "从 bundle 文件导入资产",
    "import.option.policy": "冲突策略：user_confirm|overwrite|skip|newer_first|keep_both",
    "import.readingBundle": "正在读取 bundle：{bundleId}（{count} 个资产）",
    "import.completed": "✓ 导入完成：{status}",
    "import.status.completed": "completed",
    "import.status.completed_with_conflicts": "completed_with_conflicts",
    "import.status.failed": "failed",
    "import.summary": "  总数：{total} | 导入：{imported} | 跳过：{skipped} | 覆盖：{overwritten}",
    "import.conflicts": "⚠ 检测到 {count} 个冲突：",
    "import.header.assetId": "资产 ID",
    "import.header.type": "类型",
    "import.header.conflictingFields": "冲突字段",
    "import.conflictsHint": "冲突资产已跳过。可使用 --policy overwrite|newer_first|keep_both 处理。",
    "import.errors": "❌ 有 {count} 个错误：",

    "trace.command.description": "管理执行 Trace",
    "trace.start.description": "开始一条新的 Trace 会话",
    "trace.start.option.session": "Session ID",
    "trace.start.option.workflow": "Workflow ID",
    "trace.start.success": "✓ 已开始 Trace：{traceId}",
    "trace.start.session": "  Session：{sessionId}",
    "trace.start.workflow": "  Workflow：{workflowId}",

    "trace.event.description": "向 Trace 追加事件",
    "trace.event.option.type": "事件类型（例如 tool_called、error_raised）",
    "trace.event.option.node": "节点 ID",
    "trace.event.option.payload": "JSON 载荷",
    "trace.event.success": "✓ 已向 {traceId} 追加事件：{eventType}（当前共 {count} 个事件）",

    "trace.finalize.description": "以状态和 lessons 完成一条 Trace",
    "trace.finalize.option.status": "最终状态：success|failed|falsified",
    "trace.finalize.option.lesson": "添加 lesson（可重复）",
    "trace.finalize.option.counterfactual": "添加 counterfactual（可重复）",
    "trace.finalize.success": "✓ 已完成 Trace：{traceId}",
    "trace.finalize.status": "  状态：{status}",
    "trace.finalize.events": "  事件数：{count}",
    "trace.finalize.lessons": "  Lessons：{count}",
    "trace.finalize.counterfactuals": "  Counterfactuals：{count}",

    "trace.list.description": "列出 Trace",
    "trace.list.option.status": "按状态筛选",
    "trace.list.option.limit": "最大返回数量",
    "trace.list.none": "没有找到 Trace。",
    "trace.list.header.traceId": "Trace ID",
    "trace.list.header.session": "Session",
    "trace.list.header.status": "状态",
    "trace.list.header.events": "事件数",
    "trace.list.header.lessons": "Lessons",
    "trace.list.total": "总计：{count} 条 Trace",

    "trace.get.description": "查看 Trace 详情",
    "trace.get.option.summary": "仅显示摘要，不显示完整 Trace",
    "trace.get.summary.trace": "Trace：{traceId}",
    "trace.get.summary.statusEvents": "状态：{status} | 事件：{count}",
    "trace.get.summary.groups": "分组：{groups}",
    "trace.get.summary.containsFailures": "⚠ 包含失败事件",
    "trace.get.summary.containsFalsifications": "⚠ 包含证伪事件",
    "trace.get.summary.lessons": "Lessons：{count}",
    "trace.get.detail.traceId": "Trace ID",
    "trace.get.detail.session": "Session",
    "trace.get.detail.workflow": "Workflow",
    "trace.get.detail.status": "状态",
    "trace.get.detail.events": "事件（{count}）",
    "trace.get.detail.lessons": "Lessons：",
    "trace.get.detail.counterfactuals": "Counterfactuals：",

    "trace.falsified.description": "提取所有被证伪的假设",
    "trace.falsified.option.limit": "最多扫描的 Trace 数量",
    "trace.falsified.none": "没有找到被证伪的假设。",
    "trace.falsified.heading": "找到 {count} 条被证伪的假设：",
    "trace.falsified.evidence": "证据：{evidence}",
    "trace.falsified.time": "时间：{time}",

    "report.command.description": "生成和管理治理报告",
    "report.generate.description": "生成月度证伪报告（YYYY-MM）",
    "report.generate.success": "✓ 已生成证伪报告：{reportId}",
    "report.generate.month": "  月份：{month}",
    "report.generate.judgments": "  判断数：{count}",
    "report.generate.highImpact": "  高影响：{count}",
    "report.generate.frozenMemories": "  冻结记忆：{count}",
    "report.generate.hash": "  Hash：{hash}",
    "report.generate.actions": "已执行动作：",
    "report.generate.none": "✓ 本月没有被证伪的判断。",

    "report.show.description": "查看一份证伪报告（YYYY-MM）",
    "report.show.title": "证伪报告：{month}",
    "report.show.generated": "生成时间：{generatedAt}",
    "report.show.hash": "Hash：{hash}",
    "report.show.acknowledged": "确认状态：{value}",
    "report.show.notYet": "尚未确认",
    "report.show.summary": "摘要：",
    "report.show.judgments": "判断：",
    "report.show.sourceEvidence": "来源：{source} | 证据：{evidence}",
    "report.show.actions": "动作：{actions}",

    "report.acknowledge.description": "确认一份证伪报告（确认前视为核心使用未校准）",
    "report.acknowledge.success": "✓ 已在 {timestamp} 确认报告 {month}",

    "report.list.description": "列出所有证伪报告",
    "report.list.none": "还没有生成任何报告。",
    "report.list.unacknowledged": "⚠ 未确认",
    "report.list.line": "  {month} | 判断：{judgments} | 高影响：{high} | {ack}",

    "error.workspace.notFound": "未找到 MoonOS 工作区（.moonos/ 目录）。\n请先运行 `moonos init` 初始化工作区。",
    "error.memory.notFound": "未找到记忆：{id}",
    "error.memory.unknownReviewDecision": "未知复审决策：{decision}",
    "error.trace.notFound": "未找到 Trace：{id}",
    "error.report.notFound": "未找到报告：{month}",
    "error.storage.itemAlreadyExists": "条目已存在：{collection}/{id}",
    "error.storage.itemNotFound": "未找到条目：{collection}/{id}",
    "error.protocol.invalidSemver": "无效的 semver：{version}",

    "validation.semver": "版本号必须符合 major.minor.patch",
    "validation.semverSelector": "版本选择器必须符合 major.minor.patch 或 major.minor.x",
    "validation.sha256": "hash 必须符合 sha256:<64 位十六进制>",
    "validation.yearMonth": "月份必须符合 YYYY-MM",
    "validation.expiresAfterCreatedAt": "expires_at 必须晚于 created_at",

    "governance.memory.globalDirectional.missingExpiresAt": "全局方向型记忆必须设置 expires_at",
    "governance.memory.globalDirectional.expiryTooLong": "全局方向型记忆有效期不得超过 {maxDays} 天",
    "governance.memory.counterEvidenceRequired": "全局方向型记忆激活前，建议至少添加一条反方锚点",
    "governance.memory.invalidTransition": "非法状态转换：{current} → {target}",
    "governance.memory.lowConfidence": "记忆 confidence 仅为 {confidence}，建议收集更多证据后再激活",
  },
};

const KNOWN_EXACT_MESSAGES: Record<string, string> = {
  "Version must match major.minor.patch": "validation.semver",
  "Version selector must match major.minor.patch or major.minor.x": "validation.semverSelector",
  "Hash must match sha256:<64 hex chars>": "validation.sha256",
  "Month must match YYYY-MM": "validation.yearMonth",
  "expires_at must be later than created_at": "validation.expiresAfterCreatedAt",

  "版本号必须符合 major.minor.patch": "validation.semver",
  "版本选择器必须符合 major.minor.patch 或 major.minor.x": "validation.semverSelector",
  "hash 必须符合 sha256:<64 位十六进制>": "validation.sha256",
  "月份必须符合 YYYY-MM": "validation.yearMonth",
  "expires_at 必须晚于 created_at": "validation.expiresAfterCreatedAt",

  "全局方向型记忆必须设置 expires_at": "governance.memory.globalDirectional.missingExpiresAt",
  "Global directional memory must set expires_at": "governance.memory.globalDirectional.missingExpiresAt",
  "全局方向型记忆激活为 active 前，建议至少绑定一条反方锚点（counter_evidence）": "governance.memory.counterEvidenceRequired",
  "Global directional memories should add at least one counter-evidence before activation": "governance.memory.counterEvidenceRequired",

  "未找到 MoonOS 工作区（.moonos/ 目录）。\n请先运行 `moonos init` 初始化工作区。": "error.workspace.notFound",
  "MoonOS workspace not found (.moonos/ directory).\nRun `moonos init` first.": "error.workspace.notFound",
};

const KNOWN_MESSAGE_PATTERNS: Array<{
  regex: RegExp;
  key: string;
}> = [
  { regex: /^Memory not found: (?<id>.+)$/, key: "error.memory.notFound" },
  { regex: /^未找到记忆：(?<id>.+)$/, key: "error.memory.notFound" },
  { regex: /^Trace not found: (?<id>.+)$/, key: "error.trace.notFound" },
  { regex: /^未找到 Trace：(?<id>.+)$/, key: "error.trace.notFound" },
  { regex: /^Report not found: (?<month>.+)$/, key: "error.report.notFound" },
  { regex: /^未找到报告：(?<month>.+)$/, key: "error.report.notFound" },
  { regex: /^Unknown review decision: (?<decision>.+)$/, key: "error.memory.unknownReviewDecision" },
  { regex: /^未知复审决策：(?<decision>.+)$/, key: "error.memory.unknownReviewDecision" },
  { regex: /^Invalid semver: (?<version>.+)$/, key: "error.protocol.invalidSemver" },
  { regex: /^无效的 semver：(?<version>.+)$/, key: "error.protocol.invalidSemver" },
  { regex: /^Item already exists: (?<collection>[^/]+)\/(?<id>.+)$/, key: "error.storage.itemAlreadyExists" },
  { regex: /^条目已存在：(?<collection>[^/]+)\/(?<id>.+)$/, key: "error.storage.itemAlreadyExists" },
  { regex: /^Item not found: (?<collection>[^/]+)\/(?<id>.+)$/, key: "error.storage.itemNotFound" },
  { regex: /^未找到条目：(?<collection>[^/]+)\/(?<id>.+)$/, key: "error.storage.itemNotFound" },
  { regex: /^Global directional memory expiry must not exceed (?<maxDays>\d+) days$/, key: "governance.memory.globalDirectional.expiryTooLong" },
  { regex: /^全局方向型记忆有效期不得超过 (?<maxDays>\d+) 天$/, key: "governance.memory.globalDirectional.expiryTooLong" },
  { regex: /^Invalid lifecycle transition: (?<current>.+) → (?<target>.+)$/, key: "governance.memory.invalidTransition" },
  { regex: /^非法状态转换: (?<current>.+) → (?<target>.+)$/, key: "governance.memory.invalidTransition" },
  { regex: /^非法状态转换：(?<current>.+) → (?<target>.+)$/, key: "governance.memory.invalidTransition" },
  { regex: /^Memory confidence is only (?<confidence>.+); collect more evidence before activation$/, key: "governance.memory.lowConfidence" },
  { regex: /^记忆 confidence 仅为 (?<confidence>.+)，建议收集更多证据后再激活$/, key: "governance.memory.lowConfidence" },
  { regex: /^Frozen memory: (?<id>.+)$/, key: "report.generate.actionFrozenMemory" },
  { regex: /^Report saved: (?<id>.+)$/, key: "report.generate.actionSaved" },
  { regex: /^Unknown asset type: (?<type>.+) \((?<id>.+)\)$/, key: "import.error.unknownAssetType" },
  { regex: /^Failed to import (?<id>.+): (?<reason>.+)$/, key: "import.error.failedToImport" },
];

function interpolate(template: string, params: Record<string, unknown> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = params[key];
    return value === undefined || value === null ? `{${key}}` : String(value);
  });
}

function extractLangArg(argv: string[]): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--lang") return argv[i + 1];
    if (arg.startsWith("--lang=")) return arg.slice("--lang=".length);
  }
  return undefined;
}

export function normalizeCliLocale(input?: string): CliLocale {
  if (!input) return DEFAULT_LOCALE;

  const normalized = input.toLowerCase().replaceAll("_", "-");
  if (normalized.startsWith("zh")) return "zh-CN";
  if (normalized.startsWith("en")) return "en";
  return DEFAULT_LOCALE;
}

export function initializeCliI18n(
  argv: string[] = process.argv,
  env: NodeJS.ProcessEnv = process.env,
): CliLocale {
  const fromArg = extractLangArg(argv);
  currentLocale = normalizeCliLocale(fromArg ?? env.MOONOS_LANG ?? env.LANG);
  return currentLocale;
}

export function setCliLocale(locale?: string): CliLocale {
  currentLocale = normalizeCliLocale(locale);
  return currentLocale;
}

export function getCliLocale(): CliLocale {
  return currentLocale;
}

export function t(key: string, params: Record<string, unknown> = {}): string {
  const template = MESSAGE_CATALOG[currentLocale][key]
    ?? MESSAGE_CATALOG[DEFAULT_LOCALE][key]
    ?? key;
  return interpolate(template, params);
}

export function formatDateShort(value?: string): string {
  if (!value) return t("common.na");

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(currentLocale === "zh-CN" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function translateKnownMessage(message: string): string {
  const exactKey = KNOWN_EXACT_MESSAGES[message];
  if (exactKey) return t(exactKey);

  for (const entry of KNOWN_MESSAGE_PATTERNS) {
    const matched = message.match(entry.regex);
    if (matched?.groups) {
      return t(entry.key, matched.groups);
    }
  }

  return message;
}

export function formatGovernanceViolation(
  violation: Pick<GovernanceViolation, "message" | "message_key" | "message_params">,
): string {
  if (violation.message_key) {
    return t(violation.message_key, violation.message_params ?? {});
  }
  return translateKnownMessage(violation.message);
}

export function formatCliError(err: unknown): string {
  if (err instanceof GovernanceViolationError) {
    return err.result.violations
      .map((violation) => `[${violation.rule}] ${formatGovernanceViolation(violation)}`)
      .join("\n");
  }

  if (err instanceof MoonOSError) {
    return t(err.code, err.params);
  }

  if (err instanceof ZodError) {
    return err.issues
      .map((issue) => {
        const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
        return `${path}${translateKnownMessage(issue.message)}`;
      })
      .join("; ");
  }

  if (err instanceof Error) {
    return translateKnownMessage(err.message);
  }

  return `${t("common.unknownError")}: ${String(err)}`;
}
