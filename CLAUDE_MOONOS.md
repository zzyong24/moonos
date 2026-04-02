# MoonOS Rules for AI

[English](./CLAUDE_MOONOS.md) | [简体中文](./CLAUDE_MOONOS.zh-CN.md)

## Startup

At the beginning of each conversation, run one command to load the current working context:

```bash
moonos briefing
```

This returns a compact briefing with active memory, governance alerts, and falsified hypotheses. In most cases, that is enough.

If you need details for a specific memory, expand it on demand:

```bash
moonos memory get <id> --json
```

## When to Write Memory

| User says | You do |
|-------------|---------|
| "I like / prefer / usually..." | `moonos memory create -t profile --title "..." --content "..."` |
| "I decided / the strategy is / we will not..." | `moonos memory create -t policy ...` → **ask for counter-evidence** |
| "The lesson from last time is / we learned..." | `moonos memory create -t experience ...` |
| "The project context is / we are currently doing..." | `moonos memory create -t context --scope project ...` |
| "What we said before was wrong / the assumption was overturned" | `moonos memory review <id> -d falsify` + create the replacement memory |

## Three Red Lines

1. **Policy requires counter-evidence**: after storing a `policy`, ask: *"What could make this judgment fail?"* Then write it with `moonos memory add-counter-evidence <id> --text "..."`.
2. **Do not over-store**: one-off answers should not become memory. If it is unlikely to matter 30 days later, do not store it.
3. **Do not ignore governance alerts**: when `briefing` shows `⚠` or `🔴`, raise it before continuing normal work.

## On-Demand Commands

```bash
moonos memory stats              # governance dashboard
moonos memory needs-review       # expired / review-needed memory
moonos memory auto-downgrade     # automatic downgrade
moonos report generate 2026-04   # monthly falsification report
moonos export -o backup.json     # backup
```
