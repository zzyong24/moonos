# MoonOS 使用指南

[English](./USAGE.md) | [简体中文](./USAGE.zh-CN.md)

这份文档带你走一遍 MoonOS 的完整使用流程：初始化工作区、创建并治理记忆、记录 trace、生成月度证伪报告，以及导入导出资产。

## 目录

- [1. 初始化工作区](#1-初始化工作区)
- [2. 记忆生命周期](#2-记忆生命周期)
- [3. 治理操作](#3-治理操作)
- [4. Trace 工作流](#4-trace-工作流)
- [5. 月度证伪报告](#5-月度证伪报告)
- [6. 导入与导出](#6-导入与导出)
- [7. 协议查看](#7-协议查看)
- [8. 推荐使用模式](#8-推荐使用模式)
- [9. 命令速查](#9-命令速查)

---

## 1. 初始化工作区

在你想管理 AI 资产的目录里初始化 MoonOS：

```bash
moonos init
```

这会创建 `.moonos/` 目录，其中包含配置、各 collection 的存储和索引。

查看工作区状态：

```bash
moonos status
```

典型输出：

```text
MoonOS Workspace: /Users/you/projects/my-ai-work
Protocol Version: 0.3.0
Total Assets: 0
(empty workspace)
```

> 在开发环境里，`moonos` 等价于 `npx tsx src/cli/index.ts`。如果你还没有把 CLI 安装成全局命令，可以把下面示例里的 `moonos` 替换为 `npx tsx src/cli/index.ts`。

---

## 2. 记忆生命周期

### 2.1 创建记忆

新建记忆默认是 `hypothesis`。这是刻意设计：**一个判断在验证之前，应该被当作假说而不是事实**。

```bash
moonos memory create \
  -t profile \
  --title "我偏好简洁回答" \
  --content "我偏好简洁、直接的回答，不需要不必要的前言。"

moonos memory create \
  -t experience \
  --title "MoonOS v1 的教训" \
  --content "我们过早在 UI 上投入太多，协议引擎才是真正的核心。" \
  --scope project \
  --tags "moonos,postmortem"

moonos memory create \
  -t policy \
  --title "MoonOS 不应该变成模型专属客户端" \
  --content "MoonOS 应该保持控制面的定位，而不是跟着某个阶段性最强模型绑定。" \
  --confidence 0.8
```

全局方向型记忆（global scope 下的 `policy` / `profile` / `context`）会自动获得更严格的治理约束：

- 有效期上限 180 天
- 进入复审策略
- 到期前进入提醒窗口

### 2.2 列表与查看记忆

```bash
moonos memory list
moonos memory list -t policy
moonos memory list -s active
moonos memory get mem_xxxxx
moonos memory get mem_xxxxx --json
```

### 2.3 激活记忆

当一个假说被验证到足以投入实际使用时：

```bash
moonos memory activate mem_xxxxx --notes "经过两周使用验证有效"
```

典型输出：

```text
Memory activated: mem_xxxxx
Status: active
Expires: 2026-09-29T...
```

如果一个重大判断还没有反方锚点，你也可能收到治理警告。这是刻意的：**没有活着的反对证据，判断就很危险**。

### 2.4 添加反方锚点

```bash
moonos memory add-counter-evidence mem_xxxxx \
  --text "仍然有一部分用户觉得控制面这个概念太抽象"

moonos memory add-counter-evidence mem_xxxxx \
  --text "某个竞品通过绑定单一模型获得了更强的一致性体验"
```

反方锚点的作用：

- 让对立解释始终可见
- 为后续证伪报告提供依据
- 降低系统变成认知回音室的风险

---

## 3. 治理操作

### 3.1 复审记忆

```bash
moonos memory review mem_xxxxx -d confirm --notes "仍然有效"
moonos memory review mem_xxxxx -d delay
moonos memory review mem_xxxxx -d deprecate --notes "已被新策略替代"
moonos memory review mem_xxxxx -d falsify --notes "用户证据推翻了这个假设"
```

### 3.2 批量复审

```bash
moonos memory needs-review
moonos memory batch-review --action delay --notes "下周统一复审"
moonos memory batch-review --action confirm
```

### 3.3 自动降级

超过宽限期仍未复审的 active 记忆，会被自动降级为 `hypothesis`：

```bash
moonos memory auto-downgrade
```

这样做是为了防止过期信心悄悄变成永久真理。

### 3.4 治理仪表盘

```bash
moonos memory stats
```

它会给出一个紧凑的治理视图：状态分布、类型分布、到期压力和降级压力。

---

## 4. Trace 工作流

Trace 记录 AI 工作到底是怎么发生的，让成功可以重放，让失败可以回看。

### 4.1 记录一次运行

```bash
moonos trace start --session sess_20260402_writing --workflow wf_article_gen

moonos trace event trace_xxxxx \
  --type tool_called \
  --node collect \
  --payload '{"tool":"collect_content","url":"https://example.com"}'

moonos trace event trace_xxxxx \
  --type agent_reasoned \
  --node reason \
  --payload '{"model":"claude-4","tokens":1200}'

moonos trace event trace_xxxxx \
  --type hypothesis_falsified \
  --payload '{"hypothesis":"用户只关心功能","evidence":"反馈显示他们更在意数据所有权"}'

moonos trace finalize trace_xxxxx \
  --status success \
  --lesson "用户画像必须区分 builder 和 creator" \
  --lesson "collect 节点需要超时重试" \
  --counterfactual "如果换成本地模型，也许延迟更低，但质量可能下降"
```

### 4.2 查看 Trace

```bash
moonos trace list
moonos trace get trace_xxxxx --summary
moonos trace get trace_xxxxx
moonos trace falsified
```

用 `trace falsified` 可以汇总跨多次运行中被推翻的假设。

---

## 5. 月度证伪报告

建议每月生成一次报告，集中查看系统到底错在了哪里。

### 5.1 生成

```bash
moonos report generate 2026-04
```

生成器会自动：

- 扫描 trace 里的证伪事件
- 扫描被证伪或降级的 memory
- 扫描 critical 外部反馈
- 对高影响判断冻结相关 memory
- 写入完整性哈希

### 5.2 查看

```bash
moonos report show 2026-04
```

### 5.3 确认

```bash
moonos report acknowledge 2026-04
```

确认这一步是刻意保留的：报告不是为了生成而生成，而是为了真正被看见。

### 5.4 查看历史

```bash
moonos report list
```

---

## 6. 导入与导出

### 6.1 导出

```bash
moonos export -o backup.json
moonos export -o memories.json --collections memory
moonos export --json
```

导出结果是一个 `AssetBundle`，其中包含资产数据、完整性信息和 collection 统计。

### 6.2 导入

```bash
moonos import backup.json
moonos import backup.json --policy overwrite
moonos import backup.json --policy keep_both
moonos import backup.json --policy newer_first
```

导入时检测的是**字段级冲突**，不只是条目重复。

### 6.3 跨工作区迁移

```bash
cd ~/workspace-a && moonos export -o /tmp/transfer.json
cd ~/workspace-b && moonos import /tmp/transfer.json
```

---

## 7. 协议查看

```bash
moonos protocols list
moonos protocols show memory
moonos protocols show workflow
moonos protocols show asset-bundle
```

当你关心的是 schema 边界，而不是运行时行为时，用这组命令最合适。

---

## 8. 推荐使用模式

### 模式 A：AI 工作日志

把有长期价值的经验沉淀成 `experience`：

```bash
moonos memory create \
  -t experience \
  --title "用 Claude 重构认证模块" \
  --content "关键决策：从 session-based auth 切到 JWT。refresh-token 的方案比原来设想更好。" \
  --scope project \
  --tags "auth,refactor,claude"
```

### 模式 B：沉淀重大决策

把重大判断存成 `policy`，然后立刻补上反方锚点：

```bash
moonos memory create \
  -t policy \
  --title "当前阶段不做移动端" \
  --content "当前聚焦 CLI 和 Web，移动端会在核心闭环稳定前分散精力。"

moonos memory add-counter-evidence mem_xxxxx \
  --text "但一旦协作层成熟，移动端使用场景可能变得重要"

moonos memory activate mem_xxxxx --notes "团队讨论后确认"
```

### 模式 C：每周 / 每月校准

```bash
moonos memory stats
moonos memory needs-review
moonos memory auto-downgrade
moonos report generate 2026-04
moonos report show 2026-04
moonos report acknowledge 2026-04
```

### 模式 D：记录关键工作流

```bash
moonos trace start --session today_writing --workflow article_gen
# 在工作进行中不断追加事件
moonos trace finalize trace_xxxxx --status success \
  --lesson "大纲阶段给 AI 的上下文越精确，最终输出越好"
```

### 模式 E：定期备份

```bash
moonos export -o ~/backups/moonos-$(date +%Y%m%d).json
```

---

## 9. 命令速查

| 命令 | 作用 |
|------|------|
| `moonos init` | 初始化 `.moonos/` 工作区 |
| `moonos status` | 查看工作区状态 |
| `moonos memory create` | 创建记忆（`hypothesis`） |
| `moonos memory list` | 列出记忆 |
| `moonos memory get <id>` | 查看详情 |
| `moonos memory activate <id>` | 激活记忆 |
| `moonos memory review <id> -d <decision>` | 复审记忆 |
| `moonos memory batch-review` | 批量复审 |
| `moonos memory auto-downgrade` | 自动降级 |
| `moonos memory add-counter-evidence <id>` | 添加反方锚点 |
| `moonos memory needs-review` | 查看待复审记忆 |
| `moonos memory stats` | 治理仪表盘 |
| `moonos trace start` | 开始 trace |
| `moonos trace event <id>` | 追加事件 |
| `moonos trace finalize <id>` | 完成 trace |
| `moonos trace list` | 列出 trace |
| `moonos trace get <id>` | 查看 trace / `--summary` |
| `moonos trace falsified` | 提取被证伪假设 |
| `moonos report generate <YYYY-MM>` | 生成月度报告 |
| `moonos report show <YYYY-MM>` | 查看报告 |
| `moonos report acknowledge <YYYY-MM>` | 确认报告 |
| `moonos report list` | 报告列表 |
| `moonos export` | 导出资产包 |
| `moonos import <file>` | 导入资产包 |
| `moonos protocols list` | 查看协议目录 |
| `moonos protocols show <id>` | 查看 JSON Schema |
| `moonos briefing` | 输出紧凑记忆上下文 |

所有命令都支持 `--json`，CLI 现在也支持 `--lang` 做本地化输出。
