# AI Integration Guide for MoonOS

[English](./AI_INTEGRATION.md) | [简体中文](./AI_INTEGRATION.zh-CN.md)

This document explains how to integrate MoonOS into AI tools so memory, governance, and trace become part of the assistant workflow instead of an afterthought.

## Core Truth

You cannot literally *force* an LLM to obey rules in the same way you force deterministic software. What you can do is move compliance from weak suggestion to strong default.

The practical levers are:

1. **Keep the operating rules short enough to survive prompt pressure**
2. **Use the platform's native enforcement points** — hooks, rules files, MCP, tool access, or code-level wrappers
3. **Make non-compliance expensive** — if the assistant skips `briefing`, it loses the current working context and the quality naturally drops

The compact rule set lives in **[CLAUDE_MOONOS.md](./CLAUDE_MOONOS.md)**. This document explains how to deploy those rules across platforms.

## Integration Matrix

| Platform | Enforcement strength | Mechanism | Status |
|------|------|------|------|
| **Claude Code** | ★★★★★ | rules file + hooks + terminal execution | ✅ best current path |
| **Cursor** | ★★★★ | rules file + terminal execution | ✅ practical |
| **ChatGPT** | ★★★ | custom instructions + actions/API | ⚡ partial |
| **Gemini** | ★★ | system instructions | ⚡ partial |
| **Open WebUI / LobeChat** | ★★★★ | system prompt + MCP/plugin route | ⚡ promising |
| **Custom agent** | ★★★★★ | code-level enforcement | ✅ strongest possible |

---

## 1. Claude Code

Claude Code is currently the strongest integration point because it gives you three useful layers:

- a persistent rules document
- hooks
- direct terminal execution

### 1.1 Rules file injection

Add MoonOS guidance to `~/.claude/CLAUDE.md` or the project-level `.claude/CLAUDE.md`:

```markdown
## MoonOS Integration

At the start of each conversation, run `moonos briefing` to load memory context.
Full operating rules: ~/workbase/github/moonos/CLAUDE_MOONOS.md
```

This is the most reliable always-loaded instruction surface.

### 1.2 Hooks

Add hooks in `~/.claude/settings.json` so MoonOS runs automatically at session boundaries:

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

Effect:

- **SessionStart** injects the current briefing before the assistant begins work
- **Stop** automatically runs downgrade checks so expired memory does not silently accumulate

### 1.3 Direct terminal execution

Claude Code can directly run MoonOS commands as part of normal work:

```bash
moonos memory create -t policy --title "..." --content "..."
moonos memory add-counter-evidence <id> --text "..."
moonos trace start --session sess_xxx
```

Why this path is strongest:

- the assistant sees the rules
- hooks reduce reliance on assistant discipline
- terminal access allows direct read/write operations

---

## 2. Cursor

### 2.1 Rules file injection

Put the content of `CLAUDE_MOONOS.md` into `.cursorrules` or the equivalent project rules surface used by your Cursor setup.

### 2.2 Direct terminal execution

Cursor agent/composer modes can execute terminal commands. In your rules, explicitly say that the assistant should use MoonOS commands when it detects persistent preference, policy, context, or experience.

### 2.3 Limitation

Cursor does not provide the same hook layer, so `briefing` is not as automatic as Claude Code. A practical rule is:

```text
At the start of each conversation, run `moonos briefing` and read the output before responding.
```

This works well in practice but is still weaker than a hook-backed flow.

---

## 3. ChatGPT

ChatGPT does not have native terminal access, so the current integration is usually advisory unless you build an API layer.

### 3.1 Custom Instructions

Use a compact instruction set such as:

```text
I use MoonOS to manage AI assets. When I express stable preferences, decisions, project context, or lessons, suggest the appropriate MoonOS command.

Preference → moonos memory create -t profile --title "..." --content "..."
Decision → moonos memory create -t policy --title "..." --content "..." and ask for counter-evidence
Lesson → moonos memory create -t experience --title "..." --content "..."
Overturned judgment → moonos memory review <id> -d falsify and create a replacement memory

Do not suggest storage for one-off content. Only suggest it when the information is likely to retain value later.
```

### 3.2 GPT Actions / API

If you expose MoonOS through an HTTP API, GPT Actions can call it directly. That turns ChatGPT from a command suggester into a real operator.

Example action surface:

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

Without an API, ChatGPT is mainly a recommendation layer.

---

## 4. Gemini

Gemini currently works best in light-guidance mode.

### 4.1 System Instructions

Use a short system instruction such as:

```text
The user uses MoonOS to manage memory and governance. When the user makes a durable judgment, suggest storing it with moonos memory create. For policy judgments, ask what could make the judgment fail.
```

### 4.2 Limitation

- no native MoonOS terminal path
- no hook layer comparable to Claude Code
- weaker instruction persistence under pressure

Gemini is therefore better for reminders than for hard integration.

---

## 5. Open WebUI / LobeChat

Open-source AI frontends become much stronger once MoonOS is exposed as a tool surface.

### 5.1 System prompt

Inject `CLAUDE_MOONOS.md` or a shortened variant into the model configuration.

### 5.2 MCP / plugin path

If MoonOS is exposed as an MCP server or equivalent plugin/tool layer, the assistant can call MoonOS capabilities directly instead of merely remembering rules.

Potential tool surface:

```text
moonos_briefing
moonos_memory_create
moonos_memory_add_counter_evidence
moonos_trace_start
moonos_trace_finalize
```

This is the most promising path for strong non-code integrations.

---

## 6. Custom Agent

A custom agent is the strongest possible integration because MoonOS can become part of the control loop itself.

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

In this model, MoonOS is no longer an optional convention. It becomes part of the runtime architecture.

---

## Enforcement Ladder

```text
Level 0: no integration
  ↓
Level 1: custom instructions / system prompt
  ↓
Level 2: persistent rules file
  ↓
Level 3: rules file + hooks + direct commands
  ↓
Level 4: MCP / tool surface
  ↓
Level 5: code-level agent integration
```

If you are already using Claude Code with a rules file and hooks, you are effectively at **Level 3**.

## Configuration Locations

| Platform | Location | Content source |
|------|------|------|
| Claude Code | `~/.claude/CLAUDE.md` | reference `CLAUDE_MOONOS.md` |
| Claude Code | `~/.claude/settings.json` | hooks configuration |
| Cursor | `.cursorrules` or project rules file | content from `CLAUDE_MOONOS.md` |
| ChatGPT | Settings → Custom Instructions | shortened rules |
| Gemini | AI Studio → System Instructions | shortened rules |
| Open WebUI | model/system prompt config | `CLAUDE_MOONOS.md` or shortened rules |
| LobeChat | model/system prompt config | `CLAUDE_MOONOS.md` or shortened rules |
| Custom agent | code | direct MoonOS integration |

## One-Sentence Summary

**Do not rely on longer prompts to make AI more disciplined. Use stronger execution surfaces so MoonOS becomes the assistant's operating environment instead of a suggestion.**
