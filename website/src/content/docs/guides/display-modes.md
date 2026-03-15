---
title: Display Modes
description: Compact, normal, and detailed display modes
sidebar:
  order: 1
---

claude-dashboard supports three built-in display presets plus a fully custom mode. Each mode is additive -- higher modes include all widgets from lower modes plus additional ones.

## Compact (1 line) -- Default

The compact mode displays essential metrics on a single line. This is the default when you first run setup.

**Widgets:** model, context, cost, rateLimit5h, rateLimit7d, rateLimit7dSonnet, zaiUsage

```
◆ Opus(H) │ ██░░ 80% │ $1.25 │ 5h: 42% │ 7d: 69%
```

```
/claude-dashboard:setup compact
```

## Normal (2 lines)

Adds project context, session tracking, and progress information on a second line.

**Line 1:** model, context, cost, rateLimit5h, rateLimit7d, rateLimit7dSonnet, zaiUsage<br/>
**Line 2:** projectInfo, sessionId, sessionDuration, burnRate, todoProgress

```
◆ Opus(H) │ ██░░ 80% │ $1.25 │ 5h: 42% │ 7d: 69%
📁 project (main ↑3) │ 🔑 abc123 │ ⏱ 45m │ 🔥 5K/m │ ✓ 3/5
```

```
/claude-dashboard:setup normal
```

## Detailed (6 lines)

Shows all available widgets across six lines, including analytics, tool activity, multi-CLI usage, insights, and last prompt.

**Line 1:** model, context, cost, rateLimit5h, rateLimit7d, rateLimit7dSonnet, zaiUsage<br/>
**Line 2:** projectInfo, sessionName, sessionId, sessionDuration, burnRate, tokenSpeed, depletionTime, todoProgress<br/>
**Line 3:** configCounts, toolActivity, agentStatus, cacheHit, performance<br/>
**Line 4:** tokenBreakdown, forecast, budget, todayCost<br/>
**Line 5:** codexUsage, geminiUsage, linesChanged, outputStyle, version<br/>
**Line 6:** lastPrompt

```
◆ Opus(H) │ ██░░ 80% │ $1.25 │ 5h: 42% │ 7d: 69%
📁 project (main ↑3) │ » feature-auth │ 🔑 abc123 │ ⏱ 45m │ 🔥 5K/m │ ⚡ 67 tok/s │ ⏳ 2h │ ✓ 3/5
CLAUDE.md: 2 │ ⚙️ Read(app.ts) (12 done) │ 🤖 Agent: 1 │ 📦 85% │ 🟢 72%
📊 In 30K · Out 8K │ 📈 ~$8/h │ 💵 $5/$15 │ 💰 Today: $4.83
🔷 codex │ 💎 gemini │ +156 -23 │ concise │ v1.0.80
▸ 14:32 Fix the authentication bug in middleware
```

```
/claude-dashboard:setup detailed
```

## Custom Mode

Custom mode gives you full control over which widgets appear on each line and in what order.

**Format:** `"widget1,widget2,...|widget3,widget4,..."` where `|` separates lines.

```
/claude-dashboard:setup custom auto max "model,context,cost|projectInfo,todoProgress"
```

This creates a 2-line layout:
- **Line 1:** model, context, cost
- **Line 2:** projectInfo, todoProgress

See the [Configuration](/guides/configuration/) guide for full details on custom mode.

## Multi-Provider Support

Rate limit widgets and provider-specific widgets are mutually exclusive based on provider detection:

- **Anthropic** (default): Shows `rateLimit5h`, `rateLimit7d`, `rateLimit7dSonnet`
- **z.ai / ZHIPU**: Shows `zaiUsage` instead of Anthropic rate limits

Multi-CLI widgets (`codexUsage`, `geminiUsage`) auto-hide if their respective CLIs are not installed, so you can safely include them in any mode.

## Setup Commands

```bash
# Preset modes
/claude-dashboard:setup compact             # 1 line (default)
/claude-dashboard:setup normal en pro       # 2 lines, English, Pro plan
/claude-dashboard:setup detailed ko max     # 6 lines, Korean, Max plan

# Custom mode
/claude-dashboard:setup custom auto max "model,context,cost|projectInfo,todoProgress"
```
