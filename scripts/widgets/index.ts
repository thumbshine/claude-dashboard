/**
 * Widget registry and orchestrator
 */

import type { Widget } from './base.js';
import type {
  WidgetId,
  WidgetData,
  WidgetContext,
  Config,
} from '../types.js';
import { DISPLAY_PRESETS } from '../types.js';
import { getSeparator, getVisualWidth, truncateToWidth } from '../utils/colors.js';
import { debugLog } from '../utils/debug.js';

// Widget imports
import { modelWidget } from './model.js';
import { contextWidget } from './context.js';
import { costWidget } from './cost.js';
import { rateLimit5hWidget, rateLimit7dWidget, rateLimit7dSonnetWidget } from './rate-limit.js';
import { projectInfoWidget } from './project-info.js';
import { configCountsWidget } from './config-counts.js';
import { sessionDurationWidget } from './session-duration.js';
import { toolActivityWidget } from './tool-activity.js';
import { agentStatusWidget } from './agent-status.js';
import { todoProgressWidget } from './todo-progress.js';
import { burnRateWidget } from './burn-rate.js';
import { depletionTimeWidget } from './depletion-time.js';
import { cacheHitWidget } from './cache-hit.js';
import { codexUsageWidget } from './codex-usage.js';
import { geminiUsageWidget, geminiUsageAllWidget } from './gemini-usage.js';
import { zaiUsageWidget } from './zai-usage.js';
import { sessionIdWidget, sessionIdFullWidget } from './session-id.js';

/**
 * Widget registry - maps widget IDs to widget implementations
 */
const widgetRegistry = new Map<WidgetId, Widget>([
  ['model', modelWidget],
  ['context', contextWidget],
  ['cost', costWidget],
  ['rateLimit5h', rateLimit5hWidget],
  ['rateLimit7d', rateLimit7dWidget],
  ['rateLimit7dSonnet', rateLimit7dSonnetWidget],
  ['projectInfo', projectInfoWidget],
  ['configCounts', configCountsWidget],
  ['sessionDuration', sessionDurationWidget],
  ['toolActivity', toolActivityWidget],
  ['agentStatus', agentStatusWidget],
  ['todoProgress', todoProgressWidget],
  ['burnRate', burnRateWidget],
  ['depletionTime', depletionTimeWidget],
  ['cacheHit', cacheHitWidget],
  ['codexUsage', codexUsageWidget],
  ['geminiUsage', geminiUsageWidget],
  ['geminiUsageAll', geminiUsageAllWidget],
  ['zaiUsage', zaiUsageWidget],
  ['sessionId', sessionIdWidget],
  ['sessionIdFull', sessionIdFullWidget],
] as [WidgetId, Widget][]);

/**
 * Get widget by ID
 */
export function getWidget(id: WidgetId): Widget | undefined {
  return widgetRegistry.get(id);
}

/**
 * Get all registered widgets
 */
export function getAllWidgets(): Widget[] {
  return Array.from(widgetRegistry.values());
}

/**
 * Get lines configuration based on display mode, with disabled widgets filtered out
 */
export function getLines(config: Config): WidgetId[][] {
  const lines = config.displayMode === 'custom' && config.lines
    ? config.lines
    : DISPLAY_PRESETS[config.displayMode as keyof typeof DISPLAY_PRESETS] || DISPLAY_PRESETS.compact;

  // Filter out disabled widgets
  const disabled = config.disabledWidgets;
  if (!disabled || disabled.length === 0) {
    return lines;
  }

  const disabledSet = new Set(disabled);
  return lines
    .map((line) => line.filter((id) => !disabledSet.has(id)))
    .filter((line) => line.length > 0);
}

/**
 * Get terminal width, accounting for piped stdout
 */
function getTerminalWidth(): number {
  return process.stdout.columns
    || process.stderr.columns
    || parseInt(process.env.COLUMNS || '', 10)
    || 120;
}

/**
 * Collect widget data without rendering (Phase 1)
 */
async function collectWidgetData(
  widgetId: WidgetId,
  ctx: WidgetContext
): Promise<{ widget: Widget; data: WidgetData } | null> {
  const widget = getWidget(widgetId);
  if (!widget) return null;

  try {
    const data = await widget.getData(ctx);
    if (!data) return null;
    return { widget, data };
  } catch (error) {
    debugLog('widget', `Widget '${widgetId}' getData failed`, error);
    return null;
  }
}

/** Fraction of effective width above which a widget switches to compact rendering */
const COMPACT_THRESHOLD = 0.5;

/** Minimum effective width to prevent layout collapse */
const MIN_EFFECTIVE_WIDTH = 40;

/**
 * Calculate effective width for widget layout.
 * Accounts for Claude Code's paddingX={2} (4 chars) and right-side notification area.
 */
function getEffectiveWidth(config: Config): number {
  const termWidth = getTerminalWidth();
  const outerPadding = 4; // Claude Code's paddingX={2} means 2 chars per side = 4 total
  const rightReserve = config.rightReserve ?? 25; // accounts for Claude Code's right-side notification area
  return Math.max(MIN_EFFECTIVE_WIDTH, termWidth - outerPadding - rightReserve);
}

/**
 * Render a single widget, choosing compact mode if it exceeds the compact threshold.
 * Falls back to truncation when even compact mode overflows the effective width.
 * Returns both the rendered string and its visual width to avoid redundant recalculation.
 */
function renderWidget(
  widget: Widget,
  data: WidgetData,
  ctx: WidgetContext,
  effectiveWidth: number,
): { rendered: string; width: number } {
  try {
    const normal = widget.render(data, ctx);
    const normalWidth = getVisualWidth(normal);
    if (normalWidth <= effectiveWidth * COMPACT_THRESHOLD) {
      return { rendered: normal, width: normalWidth };
    }

    const compact = widget.render(data, { ...ctx, compact: true });
    const compactWidth = getVisualWidth(compact);
    if (compactWidth > effectiveWidth) {
      const truncated = truncateToWidth(compact, effectiveWidth);
      return { rendered: truncated, width: getVisualWidth(truncated) };
    }
    return { rendered: compact, width: compactWidth };
  } catch (error) {
    debugLog('widget', `Widget '${widget.id}' render failed`, error);
    return { rendered: '', width: 0 };
  }
}

/**
 * Render a line of widgets with wrapping: widgets that exceed the effective width
 * overflow to the next line instead of being removed.
 */
async function renderLineWithWrap(
  widgetIds: WidgetId[],
  ctx: WidgetContext,
  effectiveWidth: number,
): Promise<string[]> {
  // Phase 1: collect all widget data in parallel
  const collected = await Promise.all(
    widgetIds.map((id) => collectWidgetData(id, ctx))
  );
  const valid = collected.filter(
    (w): w is { widget: Widget; data: WidgetData } => w !== null
  );

  if (valid.length === 0) return [];

  // Phase 2: place widgets one-by-one, wrapping when width is exceeded
  const separator = getSeparator();
  const sepWidth = getVisualWidth(separator);

  const resultLines: string[] = [];
  let currentRendered: string[] = [];
  let currentWidth = 0;

  for (const item of valid) {
    const { rendered, width: widgetWidth } = renderWidget(item.widget, item.data, ctx, effectiveWidth);
    if (rendered === '') continue;

    const needsSeparator = currentRendered.length > 0;
    const addedWidth = needsSeparator ? sepWidth + widgetWidth : widgetWidth;

    if (needsSeparator && currentWidth + addedWidth > effectiveWidth) {
      resultLines.push(currentRendered.join(separator));
      currentRendered = [rendered];
      currentWidth = widgetWidth;
    } else {
      currentRendered.push(rendered);
      currentWidth += addedWidth;
    }
  }

  if (currentRendered.length > 0) {
    resultLines.push(currentRendered.join(separator));
  }

  return resultLines;
}

/**
 * Render all lines based on configuration.
 * Each config line may produce multiple output lines due to widget wrapping.
 */
export async function renderAllLines(ctx: WidgetContext): Promise<string[]> {
  const configLines = getLines(ctx.config);
  const effectiveWidth = getEffectiveWidth(ctx.config);

  // Sequential iteration: each config line may wrap into multiple output lines,
  // so ordering must be preserved (parallel would interleave wrapped lines).
  const allLines: string[] = [];
  for (const lineWidgets of configLines) {
    const wrapped = await renderLineWithWrap(lineWidgets, ctx, effectiveWidth);
    allLines.push(...wrapped);
  }

  return allLines.filter((line) => line.length > 0);
}

/**
 * Format final output with multiple lines
 */
export async function formatOutput(ctx: WidgetContext): Promise<string> {
  const lines = await renderAllLines(ctx);
  return lines.join('\n');
}
