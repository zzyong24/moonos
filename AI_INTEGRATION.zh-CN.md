# MoonOS AI 集成指南

[English](./AI_INTEGRATION.md) | [简体中文](./AI_INTEGRATION.zh-CN.md)

这份文档讲的是，如何把 MoonOS 接进 AI 工具里，让 memory、governance 和 trace 成为助手工作流的一部分，而不是事后补记。

## 核心事实

你没法像约束确定性软件那样，真正“强制”一个 LLM 遵守规则。但你可以把遵守率从弱提醒，提升到强默认。

实用抓手主要有三个：

1. **操作规则必须足够短，才能扛住 prompt 压力**
2. **尽量使用平台原生的强制点** —— hooks、规则文件、MCP、工具调用能力、代码级封装
3. **让不遵守变得更贵** —— 如果助手跳过 `briefing`，它就拿不到当前上下文，回答质量自然会掉下来

精简规则写在 **[CLAUDE_MOONOS.zh-CN.md](./CLAUDE_MOONOS.zh-CN.md)**。这份文档负责讲清楚如何把这些规则落到不同平台上。

## 集成矩阵

| 平台 | 强制程度 | 机制 | 状态 |
|------|------|------|------|
| **Claude Code** | ★★★★★ | 规则文件 + hooks + 终端执行 | ✅ 当前最佳路径 |
| **Cursor** | ★★★★ | 规则文件 + 终端执行 | ✅ 实用 |
| **ChatGPT** | ★★★ | Custom Instructions + actions/API | ⚡ 部分可行 |
| **Gemini** | ★★ | system instructions | ⚡ 部分可行 |
| **Open WebUI / LobeChat** | ★★★★ | system prompt + MCP/plugin 路线 | ⚡ 很有潜力 |
| **自建 Agent** | ★★★★★ | 代码级强制 | ✅ 理论上最强 |

---

## 1. Claude Code

Claude Code 当前是最强的接入点，因为它同时给了你三层能力：

- 持久规则文档
- hooks
- 终端直接执行

### 1.1 注入规则文件

把 MoonOS 指引加到 `~/.claude/CLAUDE.md` 或项目级 `.claude/CLAUDE.md`：

```markdown
## MoonOS Integration

At the start of each conversation, run `moonos briefing` to load memory context.
Full operating rules: ~/workbase/github/moonos/CLAUDE_MOONOS.md
```

这是最可靠的常驻指令入口。

### 1.2 Hooks

在 `~/.claude/settings.json` 中加 hooks，让 MoonOS 在 session 边界自动运行：

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "cd ~/workbase/github/moonos && npx tsx src/cli/index.ts briefing 2>/dev/null || echo '[MoonOS not initialized]'"
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "cd ~/workbase/github/moonos && npx tsx src/cli/index.ts memory auto-downgrade --json 2>/dev/null || true"
          }
        ]
      }
    ]
  }
}
```

效果：

- **SessionStart**：在助手开始工作前注入最新 briefing
- **Stop**：自动运行 downgrade 检查，避免过期记忆悄悄堆积

### 1.3 终端直接执行

Claude Code 可以把 MoonOS 命令作为正常工作流的一部分直接执行：

```bash
moonos memory create -t policy --title "..." --content "..."
moonos memory add-counter-evidence <id> --text "..."
moonos trace start --session sess_xxx
```

为什么这条路线最强：

- 助手看得到规则
- hooks 降低对助手自觉性的依赖
- 终端权限允许它直接读写资产

---

## 2. Cursor

### 2.1 注入规则文件

把 `CLAUDE_MOONOS.zh-CN.md` 的内容放进 `.cursorrules`，或你当前 Cursor 使用的项目规则文件中。

### 2.2 终端直接执行

Cursor 的 agent / composer 模式可以执行终端命令。你应该在规则里明确要求：当助手识别到持久偏好、政策判断、项目上下文或经验时，使用 MoonOS 命令。

### 2.3 局限

Cursor 没有 Claude Code 那样的 hook 层，所以 `briefing` 没法天然自动执行。比较实用的规则写法是：

```text
在每次对话开始时，先运行 `moonos briefing` 并读取输出，再开始回答。
```

实际效果已经不错，但仍然弱于 hook 驱动方案。

---

## 3. ChatGPT

ChatGPT 没有原生终端权限，所以如果你不自己搭 API，它当前主要还是建议型集成，而不是直接操作型集成。

### 3.1 Custom Instructions

你可以用类似下面的精简指令：

```text
我使用 MoonOS 管理 AI 资产。当我表达稳定偏好、做出决策、提供项目上下文或总结经验时，请建议合适的 MoonOS 命令。

偏好 → moonos memory create -t profile --title "..." --content "..."
决策 → moonos memory create -t policy --title "..." --content "..."，并追问反方锚点
经验 → moonos memory create -t experience --title "..." --content "..."
被推翻的判断 → moonos memory review <id> -d falsify，并创建替代记忆

不要为一次性内容建议存储。只有在这些信息未来仍可能保留价值时才建议。
```

### 3.2 GPT Actions / API

如果你把 MoonOS 暴露成 HTTP API，GPT Actions 就可以直接调用它。这样 ChatGPT 就不只是建议命令，而是能真的去操作。

示例 action surface：

```yaml
paths:
  /api/v1/briefing:
    get:
      summary: Get memory briefing
  /api/v1/memory:
    post:
      summary: Create memory
  /api/v1/memory/{id}/counter-evidence:
    post:
      summary: Add counter-evidence
```

如果没有 API，ChatGPT 基本还是命令建议层。

---

## 4. Gemini

Gemini 当前更适合轻提醒模式。

### 4.1 System Instructions

可以使用类似下面的简短 system instruction：

```text
用户使用 MoonOS 管理 memory 和 governance。当用户做出持久判断时，建议使用 moonos memory create 存储。对于 policy 判断，追问这个判断在什么情况下会失效。
```

### 4.2 局限

- 没有原生 MoonOS 终端执行路径
- 没有类似 Claude Code 的 hook 层
- 指令在高压场景下更容易被稀释

所以 Gemini 更适合提醒，而不是硬集成。

---

## 5. Open WebUI / LobeChat

一旦 MoonOS 以工具面暴露出来，开源 AI 前端会变强很多。

### 5.1 System prompt

把 `CLAUDE_MOONOS.zh-CN.md` 或一个更短版本注入模型配置中。

### 5.2 MCP / plugin 路线

如果 MoonOS 被暴露成 MCP server 或等价插件/工具层，助手就能直接调用 MoonOS 能力，而不是只靠“记住规则”。

潜在工具面可以是：

```text
moonos_briefing
moonos_memory_create
moonos_memory_add_counter_evidence
moonos_trace_start
moonos_trace_finalize
```

这是最有希望的强集成非代码路径。

---

## 6. 自建 Agent

自建 Agent 是最强的接入方式，因为 MoonOS 可以直接进入控制回路本身。

```typescript
const briefing = execSync('moonos briefing').toString();
systemPrompt += `\n\n${briefing}`;

function postProcess(response: string) {
  const policyLike = response.match(/I decided|the strategy is|we will not/);
  if (policyLike) {
    // suggest or trigger MoonOS write behavior
  }
}

execSync('moonos memory auto-downgrade');
```

在这种模型下，MoonOS 不再是可选约定，而是运行时架构的一部分。

---

## 强制程度阶梯

```text
Level 0: 不做集成
  ↓
Level 1: custom instructions / system prompt
  ↓
Level 2: 持久规则文件
  ↓
Level 3: 规则文件 + hooks + 直接命令
  ↓
Level 4: MCP / tool surface
  ↓
Level 5: 代码级 agent integration
```

如果你已经在 Claude Code 里用了规则文件和 hooks，那你实际上已经处在 **Level 3**。

## 配置位置

| 平台 | 位置 | 内容来源 |
|------|------|------|
| Claude Code | `~/.claude/CLAUDE.md` | 引用 `CLAUDE_MOONOS.md` |
| Claude Code | `~/.claude/settings.json` | hooks 配置 |
| Cursor | `.cursorrules` 或项目规则文件 | `CLAUDE_MOONOS.md` 内容 |
| ChatGPT | Settings → Custom Instructions | 精简规则 |
| Gemini | AI Studio → System Instructions | 精简规则 |
| Open WebUI | model/system prompt config | `CLAUDE_MOONOS.md` 或精简规则 |
| LobeChat | model/system prompt config | `CLAUDE_MOONOS.md` 或精简规则 |
| 自建 Agent | 代码中 | 直接集成 MoonOS |

## 一句话总结

**不要指望更长的 prompt 让 AI 更守规矩。要用更强的执行面，让 MoonOS 成为助手的运行环境，而不是一句建议。**
