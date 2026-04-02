# MoonOS AI 规则

[English](./CLAUDE_MOONOS.md) | [简体中文](./CLAUDE_MOONOS.zh-CN.md)

## 启动

每次对话开始时，先执行一条命令，加载当前工作上下文：

```bash
moonos briefing
```

它会返回一个紧凑 briefing，包含 active memory、governance alerts 和 falsified hypotheses。大多数情况下，这些信息已经足够。

如果你需要某条 memory 的细节，再按需展开：

```bash
moonos memory get <id> --json
```

## 什么时候写入记忆

| 用户说了什么 | 你该做什么 |
|-------------|---------|
| “我喜欢 / 我偏好 / 我通常会 ...” | `moonos memory create -t profile --title "..." --content "..."` |
| “我决定 / 策略是 / 我们不会 ...” | `moonos memory create -t policy ...` → **追问反方锚点** |
| “上次的教训是 / 我们学到了 ...” | `moonos memory create -t experience ...` |
| “项目背景是 / 我们现在正在做 ...” | `moonos memory create -t context --scope project ...` |
| “之前说错了 / 这个假设被推翻了” | `moonos memory review <id> -d falsify` + 创建替代记忆 |

## 三条红线

1. **Policy 必须有反方锚点**：存完 `policy` 后，追问：*“什么情况下这个判断会失败？”* 然后用 `moonos memory add-counter-evidence <id> --text "..."` 写进去。
2. **不要过度存储**：一次性回答不应该变成 memory。如果 30 天后大概率没价值，就不要存。
3. **不要忽视治理告警**：如果 `briefing` 里出现 `⚠` 或 `🔴`，先把问题提出来，再继续正常工作。

## 按需命令

```bash
moonos memory stats              # 治理仪表盘
moonos memory needs-review       # 过期 / 待复审记忆
moonos memory auto-downgrade     # 自动降级
moonos report generate 2026-04   # 月度证伪报告
moonos export -o backup.json     # 备份
```
