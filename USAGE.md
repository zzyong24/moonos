# MoonOS Usage Guide

[English](./USAGE.md) | [简体中文](./USAGE.zh-CN.md)

This guide walks through the practical MoonOS workflow end to end: initialize a workspace, create and govern memory, record traces, generate monthly falsification reports, and import/export assets.

## Contents

- [1. Initialize a workspace](#1-initialize-a-workspace)
- [2. Memory lifecycle](#2-memory-lifecycle)
- [3. Governance operations](#3-governance-operations)
- [4. Trace workflow](#4-trace-workflow)
- [5. Monthly falsification report](#5-monthly-falsification-report)
- [6. Import and export](#6-import-and-export)
- [7. Protocol inspection](#7-protocol-inspection)
- [8. Suggested operating patterns](#8-suggested-operating-patterns)
- [9. Command reference](#9-command-reference)

---

## 1. Initialize a workspace

Initialize MoonOS in the directory where you want to govern AI assets:

```bash
moonos init
```

This creates a `.moonos/` directory with configuration, collection storage, and indexes.

Check the workspace status:

```bash
moonos status
```

Typical output:

```text
MoonOS Workspace: /Users/you/projects/my-ai-work
Protocol Version: 0.3.0
Total Assets: 0
(empty workspace)
```

> `moonos` is equivalent to `npx tsx src/cli/index.ts` in development. If you have not linked the CLI globally yet, replace `moonos` with `npx tsx src/cli/index.ts` in the examples below.

---

## 2. Memory lifecycle

### 2.1 Create memory

New memory starts as `hypothesis`. That is intentional: **a judgment should be treated as a hypothesis before it is validated**.

```bash
moonos memory create \
  -t profile \
  --title "I prefer concise answers" \
  --content "I prefer concise, direct answers without unnecessary preamble."

moonos memory create \
  -t experience \
  --title "Lesson from MoonOS v1" \
  --content "We over-invested in UI too early. The protocol engine is the real core." \
  --scope project \
  --tags "moonos,postmortem"

moonos memory create \
  -t policy \
  --title "MoonOS should not become a model-specific client" \
  --content "MoonOS should remain a control plane rather than binding itself to whichever model is strongest this quarter." \
  --confidence 0.8
```

Global directional memory (`policy` / `profile` / `context` with global scope) automatically receives stricter governance:

- expiry window capped at 180 days
- review policy set for revalidation
- reminder window before expiry

### 2.2 List and inspect memory

```bash
moonos memory list
moonos memory list -t policy
moonos memory list -s active
moonos memory get mem_xxxxx
moonos memory get mem_xxxxx --json
```

### 2.3 Activate memory

When a hypothesis has been validated enough to use operationally:

```bash
moonos memory activate mem_xxxxx --notes "Validated over two weeks of use"
```

Typical output:

```text
Memory activated: mem_xxxxx
Status: active
Expires: 2026-09-29T...
```

You may also receive a governance warning if a major judgment lacks counter-evidence. That warning is deliberate: **a judgment without a live opposing anchor is dangerous**.

### 2.4 Add counter-evidence

```bash
moonos memory add-counter-evidence mem_xxxxx \
  --text "Some users still find the control-plane framing too abstract"

moonos memory add-counter-evidence mem_xxxxx \
  --text "A competitor gained stronger UX consistency by committing to a single model"
```

Counter-evidence exists to:

- keep competing interpretations visible
- support future falsification reports
- reduce the risk of building an epistemic echo chamber

---

## 3. Governance operations

### 3.1 Review memory

```bash
moonos memory review mem_xxxxx -d confirm --notes "Still valid"
moonos memory review mem_xxxxx -d delay
moonos memory review mem_xxxxx -d deprecate --notes "Replaced by a newer strategy"
moonos memory review mem_xxxxx -d falsify --notes "User evidence overturned the assumption"
```

### 3.2 Batch review

```bash
moonos memory needs-review
moonos memory batch-review --action delay --notes "Review next week"
moonos memory batch-review --action confirm
```

### 3.3 Auto-downgrade

Active memory that remains unreviewed past the grace period is automatically downgraded to `hypothesis`:

```bash
moonos memory auto-downgrade
```

This is meant to prevent stale confidence from silently becoming permanent truth.

### 3.4 Governance dashboard

```bash
moonos memory stats
```

This gives you a compact governance view by status, type, expiry pressure, and downgrade pressure.

---

## 4. Trace workflow

Trace records how AI work actually happened so successful runs can be replayed and failed runs can be inspected.

### 4.1 Record a run

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
  --payload '{"hypothesis":"Users only care about features","evidence":"Feedback shows they care more about data ownership"}'

moonos trace finalize trace_xxxxx \
  --status success \
  --lesson "The audience model must separate builders from creators" \
  --lesson "The collect node needs retry-on-timeout" \
  --counterfactual "A local model may reduce latency but also lower quality"
```

### 4.2 Inspect traces

```bash
moonos trace list
moonos trace get trace_xxxxx --summary
moonos trace get trace_xxxxx
moonos trace falsified
```

Use `trace falsified` to extract overturned hypotheses across runs.

---

## 5. Monthly falsification report

Generate a report once per month to consolidate what the system got wrong.

### 5.1 Generate

```bash
moonos report generate 2026-04
```

The generator automatically:

- scans trace falsification events
- scans falsified or downgraded memory
- scans critical external feedback
- freezes related memory for high-impact judgments
- writes an integrity hash

### 5.2 Show

```bash
moonos report show 2026-04
```

### 5.3 Acknowledge

```bash
moonos report acknowledge 2026-04
```

Acknowledgement is intentional: the report is meant to be read, not merely generated.

### 5.4 List history

```bash
moonos report list
```

---

## 6. Import and export

### 6.1 Export

```bash
moonos export -o backup.json
moonos export -o memories.json --collections memory
moonos export --json
```

An export is written as an `AssetBundle` that includes asset data, integrity information, and collection counts.

### 6.2 Import

```bash
moonos import backup.json
moonos import backup.json --policy overwrite
moonos import backup.json --policy keep_both
moonos import backup.json --policy newer_first
```

Import detects **field-level conflicts**, not only item-level duplication.

### 6.3 Migrate across workspaces

```bash
cd ~/workspace-a && moonos export -o /tmp/transfer.json
cd ~/workspace-b && moonos import /tmp/transfer.json
```

---

## 7. Protocol inspection

```bash
moonos protocols list
moonos protocols show memory
moonos protocols show workflow
moonos protocols show asset-bundle
```

Use this when you need the schema boundary rather than the runtime behavior.

---

## 8. Suggested operating patterns

### Pattern A: AI work log

Store meaningful lessons as `experience`:

```bash
moonos memory create \
  -t experience \
  --title "Refactored the auth module with Claude" \
  --content "Key decision: move from session-based auth to JWT. The refresh-token design suggestion was better than the original plan." \
  --scope project \
  --tags "auth,refactor,claude"
```

### Pattern B: Decision capture

Store a major judgment as `policy`, then immediately attach counter-evidence:

```bash
moonos memory create \
  -t policy \
  --title "No mobile app in the current phase" \
  --content "Current focus stays on CLI and web. Mobile would split effort before the core loop is stable."

moonos memory add-counter-evidence mem_xxxxx \
  --text "But mobile usage may matter once the collaboration layer matures"

moonos memory activate mem_xxxxx --notes "Confirmed after team review"
```

### Pattern C: Weekly / monthly calibration

```bash
moonos memory stats
moonos memory needs-review
moonos memory auto-downgrade
moonos report generate 2026-04
moonos report show 2026-04
moonos report acknowledge 2026-04
```

### Pattern D: Record critical workflows

```bash
moonos trace start --session today_writing --workflow article_gen
# append events while work happens
moonos trace finalize trace_xxxxx --status success \
  --lesson "The more precise the outline context, the better the final output"
```

### Pattern E: Regular backup

```bash
moonos export -o ~/backups/moonos-$(date +%Y%m%d).json
```

---

## 9. Command reference

| Command | Purpose |
|------|------|
| `moonos init` | Initialize a `.moonos/` workspace |
| `moonos status` | Show workspace status |
| `moonos memory create` | Create memory (`hypothesis`) |
| `moonos memory list` | List memory |
| `moonos memory get <id>` | Show details |
| `moonos memory activate <id>` | Activate memory |
| `moonos memory review <id> -d <decision>` | Review memory |
| `moonos memory batch-review` | Batch review |
| `moonos memory auto-downgrade` | Auto-downgrade |
| `moonos memory add-counter-evidence <id>` | Add counter-evidence |
| `moonos memory needs-review` | Show review-needed memory |
| `moonos memory stats` | Governance dashboard |
| `moonos trace start` | Start trace |
| `moonos trace event <id>` | Append event |
| `moonos trace finalize <id>` | Finalize trace |
| `moonos trace list` | List traces |
| `moonos trace get <id>` | Show trace / `--summary` |
| `moonos trace falsified` | Extract falsified hypotheses |
| `moonos report generate <YYYY-MM>` | Generate monthly report |
| `moonos report show <YYYY-MM>` | Show report |
| `moonos report acknowledge <YYYY-MM>` | Acknowledge report |
| `moonos report list` | List reports |
| `moonos export` | Export asset bundle |
| `moonos import <file>` | Import asset bundle |
| `moonos protocols list` | Show protocol catalog |
| `moonos protocols show <id>` | Show JSON Schema |
| `moonos briefing` | Print compact memory context |

All commands support `--json`, and the CLI now supports `--lang` for localized output.
