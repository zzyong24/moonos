# MoonOS

[English](./README.md) | [简体中文](./README.zh-CN.md)

> AI Sovereignty Control Plane —— 让你的 AI 资产不再困在黑盒平台里。

MoonOS 不是聊天壳，不是工作流编辑器。它是一个 **CLI 驱动的协议引擎**，解决 3 个真实痛点：

- **换平台就重喂上下文** —— `Memory` 协议让画像、偏好、项目上下文可导出、可迁移
- **Prompt / Skill / Workflow 带不走** —— MoonOS 把资产从平台私有格式里解耦出来
- **AI 做对了不知道为什么，做错了更不知道错在哪** —— `Trace` 逐步记录执行过程，成功可复现，失败可定位

它还解决一个更深层的问题：**AI 越用越像你的复读机**。MoonOS 通过到期复审、反方锚点和月度证伪报告，防止判断在系统里无意间固化成教条。

## 快速开始

```bash
git clone <repo> && cd moonos
npm install

# 初始化工作区
npx tsx src/cli/index.ts init

# 创建第一条记忆
npx tsx src/cli/index.ts memory create \
  -t profile \
  --title "我偏好简洁回答" \
  --content "我偏好简洁、直接的回答，不需要不必要的前言。"

# 查看工作区状态
npx tsx src/cli/index.ts status
```

> 完整的使用演示和真实命令示例见 **[USAGE.zh-CN.md](./USAGE.zh-CN.md)**
>
> 将 MoonOS 接入 AI 助手：AI 读 **[CLAUDE_MOONOS.zh-CN.md](./CLAUDE_MOONOS.zh-CN.md)**，人读 **[AI_INTEGRATION.zh-CN.md](./AI_INTEGRATION.zh-CN.md)**

## 核心能力

### 记忆治理

记忆不默认是真理，而是**可治理、可复审、可证伪的对象**。

- 4 类记忆：`profile` / `context` / `experience` / `policy`
- 5 态生命周期：`hypothesis` → `active` → `deprecated` / `falsified` → `archived`
- 全局方向型记忆最长有效期为 180 天
- 激活重大判断但没有反方锚点时会触发治理警告
- 超过宽限期仍未复审的 active 记忆会自动降级

### 执行痕迹

Trace 不是日志，而是**资产**。

- 16 种事件类型，覆盖 session / memory / skill / tool / output / feedback
- 无论 `record_reasoning` 是否开启，`param_resolved` 都会被保留以便复现
- `lessons` 和 `counterfactuals` 让每次执行都能沉淀经验
- `trace falsified` 一次性提取所有被证伪的假设

### 月度证伪报告

这是一个防止系统越来越自我确认的**结构化出口**。

- 汇聚三类信号：trace 证伪事件、memory 降级/证伪、critical 外部反馈
- 生成可防篡改的 SHA256 哈希
- 对高影响判断自动冻结相关 memory
- 需要显式确认，形成真正闭环

### 资产导入 / 导出

- 将全部资产导出为带完整性校验的 `AssetBundle`
- 导入时检测**字段级冲突**，不只是条目冲突
- 支持 5 种冲突策略：`user_confirm` / `overwrite` / `skip` / `newer_first` / `keep_both`

### 协议目录

MoonOS 当前围绕 6 个主要协议和一组 supporting objects 展开，全部由 Zod 定义，并可导出为 JSON Schema。

| 协议 | 职责 |
|------|------|
| Memory | 可迁移、可治理、可证伪的记忆 |
| Skill Contract | 与具体平台解耦的能力契约 |
| Skill Implementation | 面向具体平台的实现层 |
| Workflow | 工作流结构与 resolver 策略 |
| Trace | 可复现的执行历史与证伪信号 |
| External Feedback | 用于治理的外部加权信号 |

## CLI 命令概览

```text
moonos init                              初始化工作区
moonos status                            查看工作区状态

moonos memory create                     创建记忆（初始为 hypothesis）
moonos memory list                       列出记忆
moonos memory get <id>                   查看记忆详情
moonos memory activate <id>              激活记忆（hypothesis → active）
moonos memory review <id> -d <decision>  复审记忆（confirm/delay/deprecate/falsify）
moonos memory batch-review               批量复审到期记忆
moonos memory auto-downgrade             自动降级超期记忆
moonos memory add-counter-evidence <id>  添加反方锚点
moonos memory needs-review               查看待复审记忆
moonos memory stats                      治理仪表盘

moonos trace start                       开始记录 trace
moonos trace event <id>                  追加事件
moonos trace finalize <id>               结束 trace
moonos trace list                        列出 trace
moonos trace get <id>                    查看详情 / --summary
moonos trace falsified                   提取被证伪假设

moonos report generate <YYYY-MM>         生成月度证伪报告
moonos report show <YYYY-MM>             查看报告
moonos report acknowledge <YYYY-MM>      确认报告
moonos report list                       列出报告

moonos export [-o file]                  导出资产包
moonos import <file> [--policy ...]      导入资产包

moonos protocols list                    查看协议目录
moonos protocols show <id>               查看 JSON Schema
moonos briefing                          输出 AI 启动所需的紧凑上下文
```

所有命令都支持 `--json`，CLI 也支持 `--lang` 进行本地化输出。

## 架构

```text
CLI (Commander.js)  →  Core (业务逻辑)  →  Protocols (Zod schema)
                            ↓
                       Storage (本地 JSON 文件)
```

```text
src/
├── protocols/           schema、governance、bundle/envelope、catalog
├── core/                memory / trace / reports / governance / bundle 逻辑
├── storage/             存储接口 + 本地文件适配器
└── cli/                 薄壳：解析参数 → 调 core → 格式化输出
```

- **运行时依赖极简**：`commander`、`zod`、`zod-to-json-schema`、`nanoid`
- **本地优先存储**：JSON 文件写入 `.moonos/`，原子写入，并按 collection 建索引

## 开发

```bash
npm install
npm test
npm run typecheck
npm run moonos -- status
```

当前包信息：

- 版本：`0.3.0`
- Node.js：`>=20`
- 测试命令：`vitest run`

## 设计原则

1. **主权优先** —— 资产属于用户，不属于平台。
2. **协议是底座** —— Zod schema 是单一事实源。
3. **治理必须可执行** —— 规则跑在代码里，而不只是写在文档里。
4. **从设计上反路径依赖** —— 到期复审、反方锚点、证伪报告。
5. **本地优先** —— 数据在 `.moonos/`，不在托管黑盒中。
6. **CLI 优先** —— 先把协议引擎做对，再扩展 API / UI。

## AI 集成

MoonOS 的终局**不是**让人手动敲完每一条 CLI 命令，而是让 AI 助手在明确治理约束下，直接读写、复审和导出资产。

| 文档 | 面向对象 | 用途 |
|------|------|------|
| **[CLAUDE_MOONOS.zh-CN.md](./CLAUDE_MOONOS.zh-CN.md)** | **AI 助手** | 注入 system prompt / rules file 的紧凑操作规则 |
| **[AI_INTEGRATION.zh-CN.md](./AI_INTEGRATION.zh-CN.md)** | **人类操作者** | MoonOS 接入 Claude Code、Cursor、ChatGPT、Gemini 和自建 Agent 的方法 |

最快配置路径：

1. 把 `CLAUDE_MOONOS.zh-CN.md` 的内容放进你的 AI 工具 system prompt 或规则文件
2. 如果你使用 Claude Code，增加一个 SessionStart hook 运行 `moonos briefing`
3. 让助手把 MoonOS 当作 memory / governance / trace 层来使用

## License

Apache-2.0
