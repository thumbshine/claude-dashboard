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
import { getSeparator, getVisualWidth } from '../utils/colors.js';
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

/**
 * Render collected widget data into a line string (Phase 2)
 */
function renderCollectedWidgets(
  collected: Array<{ widget: Widget; data: WidgetData } | null>,
  ctx: WidgetContext
): string {
  const separator = getSeparator();
  return collected
    .filter((w): w is { widget: Widget; data: WidgetData } => w !== null)
    .map((w) => {
      try {
        return w.widget.render(w.data, ctx);
      } catch (error) {
        debugLog('widget', `Widget '${w.widget.id}' render failed`, error);
        return '';
      }
    })
    .filter((o) => o.length > 0)
    .join(separator);
}

/**
 * Render a line of widgets with adaptive width
 * Normal render first; if too wide for terminal, re-render in compact mode
 */
async function renderLine(
  widgetIds: WidgetId[],
  ctx: WidgetContext
): Promise<string> {
  const collected = await Promise.all(
    widgetIds.map((id) => collectWidgetData(id, ctx))
  );

  const normalOutput = renderCollectedWidgets(collected, ctx);

  const termWidth = getTerminalWidth();
  const normalWidth = getVisualWidth(normalOutput);
  if (normalWidth > termWidth) {
    debugLog('render', `Line width ${normalWidth} > terminal ${termWidth}, switching to compact`);
    const compactOutput = renderCollectedWidgets(collected, { ...ctx, compact: true });
    const compactWidth = getVisualWidth(compactOutput);
    if (compactWidth > termWidth) {
      debugLog('render', `Compact width ${compactWidth} still > terminal ${termWidth}`);
    }
    return compactOutput;
  }

  return normalOutput;
}

/**
 * Render all lines based on configuration (parallel per line)
 */
export async function renderAllLines(ctx: WidgetContext): Promise<string[]> {
  const lines = getLines(ctx.config);
  const rendered = await Promise.all(lines.map((lineWidgets) => renderLine(lineWidgets, ctx)));
  return rendered.filter((line) => line.length > 0);
}

/**
 * Format final output with multiple lines
 */
export async function formatOutput(ctx: WidgetContext): Promise<string> {
  const lines = await renderAllLines(ctx);
  return lines.join('\n');
}
