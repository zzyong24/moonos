# MoonOS

[English](./README.md) | [简体中文](./README.zh-CN.md)

> AI Sovereignty Control Plane — a CLI-first protocol engine for portable, governable AI assets.

MoonOS is **not** another chat shell or workflow editor. It is a **CLI-driven protocol engine** designed to solve three practical problems:

- **Context is lost when you switch tools or models** — the `Memory` protocol makes preferences, project context, and judgments exportable and portable.
- **Prompts / skills / workflows are trapped inside vendor formats** — MoonOS decouples assets from platform-specific storage.
- **When AI succeeds you cannot reproduce it, and when it fails you cannot diagnose it** — `Trace` records execution step by step so wins are repeatable and failures are inspectable.

It also addresses a deeper risk: **AI systems become stronger versions of your own bias**. MoonOS introduces expiry reviews, counter-evidence anchors, and monthly falsification reports so judgments do not become permanent dogma by accident.

## Quick Start

```bash
git clone <repo> && cd moonos
npm install

# initialize a workspace
npx tsx src/cli/index.ts init

# create your first memory
npx tsx src/cli/index.ts memory create \
  -t profile \
  --title "I prefer concise answers" \
  --content "I prefer concise, direct answers without unnecessary preamble."

# inspect workspace status
npx tsx src/cli/index.ts status
```

> Full walkthroughs and realistic command examples: **[USAGE.md](./USAGE.md)**
>
> Integrating MoonOS into an AI assistant: AI reads **[CLAUDE_MOONOS.md](./CLAUDE_MOONOS.md)**, humans read **[AI_INTEGRATION.md](./AI_INTEGRATION.md)**

## Core Capabilities

### Memory Governance

Memory is not treated as truth by default. It is a **governable, reviewable, and falsifiable object**.

- Four memory types: `profile` / `context` / `experience` / `policy`
- Five lifecycle states: `hypothesis` → `active` → `deprecated` / `falsified` → `archived`
- Global directional memory has a maximum validity window of 180 days
- Activating a major judgment without counter-evidence produces a governance warning
- Unreviewed active memory is automatically downgraded after the grace period

### Execution Trace

Trace is not logging. It is an **asset**.

- Sixteen event types across session / memory / skill / tool / output / feedback
- `param_resolved` is preserved for reproducibility regardless of `record_reasoning`
- `lessons` and `counterfactuals` turn each run into reusable knowledge
- `trace falsified` extracts all falsified hypotheses in one step

### Monthly Falsification Report

A **structural exit valve** that prevents the system from becoming too self-confirming.

- Merges three signal sources: trace falsification events, memory downgrades/falsifications, and critical external feedback
- Generates a tamper-evident SHA256 hash
- Automatically freezes related memory for high-impact judgments
- Requires explicit acknowledgement before the loop is considered closed

### Asset Import / Export

- Export all assets as an `AssetBundle` with integrity hash
- Detect **field-level conflicts** during import rather than only item-level collisions
- Support five conflict policies: `user_confirm` / `overwrite` / `skip` / `newer_first` / `keep_both`

### Protocol Catalog

MoonOS currently centers on six major protocols plus supporting objects, all defined in Zod and exportable as JSON Schema.

| Protocol | Responsibility |
|------|------|
| Memory | Portable, governable, falsifiable memory |
| Skill Contract | Capability contract decoupled from any single platform |
| Skill Implementation | Platform-specific implementation layer |
| Workflow | Workflow structure plus resolver strategy |
| Trace | Reproducible execution history and falsification signals |
| External Feedback | Weighted external signal for governance |

## CLI Overview

```text
moonos init                              Initialize a workspace
moonos status                            Show workspace status

moonos memory create                     Create memory (starts as hypothesis)
moonos memory list                       List memory items
moonos memory get <id>                   Show memory details
moonos memory activate <id>              Activate memory (hypothesis → active)
moonos memory review <id> -d <decision>  Review memory (confirm/delay/deprecate/falsify)
moonos memory batch-review               Batch review expired memory
moonos memory auto-downgrade             Auto-downgrade overdue memory
moonos memory add-counter-evidence <id>  Add counter-evidence
moonos memory needs-review               Show memory requiring review
moonos memory stats                      Governance dashboard

moonos trace start                       Start a trace
moonos trace event <id>                  Append an event
moonos trace finalize <id>               Finalize a trace
moonos trace list                        List traces
moonos trace get <id>                    Show details / --summary
moonos trace falsified                   Extract falsified hypotheses

moonos report generate <YYYY-MM>         Generate a monthly falsification report
moonos report show <YYYY-MM>             Show a report
moonos report acknowledge <YYYY-MM>      Acknowledge a report
moonos report list                       List reports

moonos export [-o file]                  Export an asset bundle
moonos import <file> [--policy ...]      Import an asset bundle

moonos protocols list                    List the protocol catalog
moonos protocols show <id>               Show JSON Schema
moonos briefing                          Print compact memory context for AI startup
```

All commands support `--json`. The CLI also supports `--lang` for localized output.

## Architecture

```text
CLI (Commander.js)  →  Core (business logic)  →  Protocols (Zod schema)
                            ↓
                       Storage (local JSON files)
```

```text
src/
├── protocols/           schemas, governance, bundle/envelope, catalog
├── core/                memory / trace / reports / governance / bundle logic
├── storage/             storage interface + local file adapter
└── cli/                 thin shell: parse args → call core → format output
```

- **Minimal runtime dependencies**: `commander`, `zod`, `zod-to-json-schema`, `nanoid`
- **Local-first storage**: JSON files under `.moonos/`, written atomically with per-collection indexes

## Development

```bash
npm install
npm test
npm run typecheck
npm run moonos -- status
```

Current package metadata:

- Version: `0.3.0`
- Node.js: `>=20`
- Test command: `vitest run`

## Design Principles

1. **Sovereignty first** — assets belong to the user, not the platform.
2. **Protocols as the substrate** — Zod schema is the single source of truth.
3. **Governance must be executable** — rules run in code, not only in docs.
4. **Anti-path-dependence by design** — expiry review, counter-evidence, falsification reporting.
5. **Local first** — your data lives in `.moonos/`, not in a hosted black box.
6. **CLI first** — get the protocol engine right before API/UI expansion.

## AI Integration

The end state of MoonOS is **not** humans manually typing every CLI command. The end state is an AI assistant that can read, update, review, and export assets with explicit governance constraints.

| Document | Audience | Purpose |
|------|------|------|
| **[CLAUDE_MOONOS.md](./CLAUDE_MOONOS.md)** | **AI assistant** | Compact operating rules to inject into system prompts / rules files |
| **[AI_INTEGRATION.md](./AI_INTEGRATION.md)** | **Human operator** | How to integrate MoonOS into Claude Code, Cursor, ChatGPT, Gemini, and custom agents |

Fastest setup path:

1. Put the content of `CLAUDE_MOONOS.md` into your AI tool's system prompt or rules file.
2. If you use Claude Code, add a SessionStart hook that runs `moonos briefing`.
3. Let the assistant use MoonOS as the memory / governance / trace layer.

## License

Apache-2.0