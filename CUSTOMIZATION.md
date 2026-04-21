# Teamkit Fork — Customization Notes

> Fork of [uppinote20/claude-dashboard](https://github.com/uppinote20/claude-dashboard) for the Bokdori / Dori Teamkit.
> Upstream remains the source of truth for core features; this document tracks every divergence so upstream syncs stay predictable.

**Version marker**: `package.json` uses `<upstream_version>-teamkit.<N>` (e.g. `1.26.0-teamkit.4`). Bump `teamkit.N` on every fork-side change; reset to `.1` after a successful upstream sync.

---

## 1. What the fork adds

### 1.1 `teamkit` widget (new)
- **File**: `scripts/widgets/teamkit.ts`
- **Purpose**: Shows `🧰 {author}` only when the current project is a teamkit workspace (detected by the presence of `teamkit/sprint-status.yaml` from the cwd).
- **Data source**: `CLAUDE.local.md` → `author: {value}` line, read from the project root.
- **Graceful hide**: Returns `null` when the marker file is absent — widget disappears in non-teamkit projects.

### 1.2 `agentMode` widget (new)
- **File**: `scripts/widgets/agent-mode.ts`
- **Purpose**: Surfaces active-agent context from Claude Code stdin.
  - `👤 {stdin.agent.name}` — custom agent (e.g. `nv:pm`)
  - `🤖 {stdin.agent_type}` — subagent task type (e.g. `Explore`)
  - Both at once → `👤 nv:pm · 🤖 Explore`
- **Graceful hide**: Returns `null` when both fields are empty.
- **Why separate from `agentStatus`**: `agentStatus` (upstream) parses the transcript for running/done subagent tasks; `agentMode` reads stdin for the _active_ agent identity. Different data sources, different lifecycles — keeping them apart avoids tangled `getData` logic (handbook §2.1 widget isolation).

---

## 2. What the fork modifies

### 2.1 `model` widget — `scripts/widgets/model.ts`
- **Change scope**: `render()` only. All plumbing (`getModelSettings`, `EFFORT_LEVELS`, `ModelData.effortLevel`, `fastMode`) is left intact to minimise upstream merge friction.
- **Before**: `◆ Opus(X)` — `display_name` + effort suffix.
- **After**: `◆ claude-opus-4-7` — full `data.id`, no effort badge.
- **Rationale**: Full model id communicates version at a glance (sonnet-4-6 vs opus-4-7 etc.); the `(X/H/M/L)` effort badge was semantically ambiguous for the team.

### 2.2 `scripts/types.ts`
- `WidgetId` union: added `'teamkit'`, `'agentMode'`.
- `DisplayMode` union: added `'teamkit'`.
- `DISPLAY_PRESETS`:
  - `teamkit` preset (redefined as of `1.26.0-teamkit.4`): 2 lines, mirrors `normal` preset structure but retains fork-exclusive slots.
    ```typescript
    teamkit: [
      ['teamkit', 'model', 'context', 'cost', 'rateLimit5h', 'rateLimit7d', 'rateLimit7dSonnet', 'zaiUsage'],
      ['projectInfo', 'sessionDuration', 'burnRate', 'agentMode', 'agentStatus', 'todoProgress'],
    ],
    ```
    - Previous shape (`1.26.0-teamkit.1..3`) was a single line of 4 widgets (`teamkit, model, agentMode, agentStatus`), which hid context/cost/rate-limit usage. The revamp keeps `agentMode`/`agentStatus` slots while exposing usage data without requiring users to switch to `normal`.
  - Injected `'teamkit'` as the first slot of `compact` / `normal` / `detailed` presets so the author label is visible in every mode (hidden automatically in non-teamkit projects).
- `DEFAULT_CONFIG.displayMode`: `'compact'` → `'teamkit'` (fork-side default, unchanged since `.1`).
- Added `TeamkitData`, `AgentModeData` interfaces; extended `WidgetData` union.

### 2.3 `scripts/widgets/index.ts`
- `import` + `Map` entries for `teamkitWidget`, `agentModeWidget`.

### 2.4 `scripts/widgets/todo-progress.ts` (as of `1.26.0-teamkit.4`)
- **Change scope**: `getData()` only. `render()` logic untouched — only the empty-state branch removed.
- **Before**: returned `{ total: 0, completed: 0 }` when no TodoWrite/TaskCreate calls existed, and `render()` emitted a dim placeholder `Tasks: -`.
- **After**: returns `null` in the same condition, letting the orchestrator hide the widget entirely (graceful hide).
- **Rationale**: the placeholder added visual noise with no information value; empty-state hiding matches the convention used by other fork widgets (`teamkit`, `agentMode`, `agentStatus`).

### 2.5 `package.json`
- `version`: `1.26.0` → `1.26.0-teamkit.N` (fork marker).
- No dependency changes.

---

## 3. Upstream sync strategy

**Cadence**: sync when upstream ships a bug fix, a new widget we want, or a minor release.

**Steps**:
```bash
gh repo sync thumbshine/claude-dashboard          # mirror upstream → our fork
cd teamkit/tools/dashboard
git fetch origin && git pull origin main          # pull into local submodule
npm ci && npm run build                           # rebuild dist/
npm test                                          # sanity check
```

**Conflict-prone files** (expect merges here):

| File | Why it conflicts |
|------|------------------|
| `scripts/widgets/model.ts` | Upstream may refactor `render()` — preserve our `data.id` + no-effort output. |
| `scripts/widgets/todo-progress.ts` | Upstream may touch the empty-state branch — preserve the null-return in `getData()` (see §2.4). |
| `scripts/types.ts` | Upstream adds new `WidgetId` / presets — merge our additions (`teamkit`, `agentMode`, 2-line `teamkit` preset, `DISPLAY_PRESETS.compact/normal/detailed` first slot). |
| `scripts/widgets/index.ts` | Upstream adds widget registrations — keep ours at the end of the Map. |
| `package.json` | Version conflict — rebase our `-teamkit.N` suffix onto the new upstream base. |

**After a successful sync**:
1. Reset version to `<new_upstream>-teamkit.1`.
2. Run the 5-scenario stdin test matrix (see §4) before committing.
3. Commit pattern on this fork: `chore: sync upstream vX.Y.Z → teamkit.1` followed by any re-application commits.
4. Update the parent repo's submodule pointer with `[팀킷] [개선] dashboard submodule — upstream sync vX.Y.Z`.

**Non-goal**: upstreaming these widgets. The `teamkit` widget is bokdori-specific; `agentMode` might be upstreamable later but not a priority.

---

## 4. Test matrix (stdin scenarios)

Run manually before committing fork-side changes:

```bash
echo '{...}' | node dist/index.js
```

Fork baseline: `1.26.0-teamkit.4` — `teamkit` preset now renders 2 lines. Expected outputs below assume a populated `context_window` + `cost` stdin shape.

| # | stdin shape | Row 1 (usage line) | Row 2 (session line) |
|---|-------------|--------------------|----------------------|
| 1 | baseline (`model.id`, context, cost only) | `🧰 sarah │ ◆ claude-opus-4-7 │ <context bar> │ $0.50` | `📁 <project> │ ⏱ <duration>` |
| 2 | + `agent: { name: "nv:pm" }` | same as 1 | `📁 <project> │ ⏱ <duration> │ 👤 nv:pm` |
| 3 | + `agent_type: "Explore"` | same as 1 | `📁 <project> │ ⏱ <duration> │ 🤖 Explore` |
| 4 | both `agent.name` + `agent_type` | same as 1 | `📁 <project> │ ⏱ <duration> │ 👤 nv:pm · 🤖 Explore` |
| 5 | non-teamkit cwd | `◆ claude-opus-4-7 │ <context bar> │ $0.50` (🧰 hidden) | `📁 <project> │ ⏱ <duration>` |
| 6 | transcript with `TodoWrite`/`TaskCreate` | (row 1 unchanged) | row 2 appends `✓ <task> [N/M]` — otherwise hidden (§2.4) |

---

## 5. Activation (from parent repo)

Team members activate the statusline via `pnpm teamkit:setup`, which writes to `~/.claude/settings.json`:

```json
"statusLine": {
  "type": "command",
  "command": "node /abs/path/to/teamkit/tools/dashboard/dist/index.js"
}
```

See `teamkit/README.md` → dashboard section for user-facing docs.

---

*Last updated: 2026-04-21 (fork baseline 1.26.0-teamkit.4 — teamkit preset expanded to 2 rows; todoProgress hides when empty)*
