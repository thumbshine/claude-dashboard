/**
 * Context widget - displays progress bar, percentage, and token count
 */

import type { Widget } from './base.js';
import type { WidgetContext, ContextData } from '../types.js';
import { getColorForPercent, colorize, getSeparator } from '../utils/colors.js';
import { formatTokens, calculatePercent } from '../utils/formatters.js';
import { renderProgressBar, DEFAULT_PROGRESS_BAR_CONFIG } from '../utils/progress-bar.js';

/** Progress bar width used when terminal is narrow */
const COMPACT_PROGRESS_BAR_WIDTH = 6;

export const contextWidget: Widget<ContextData> = {
  id: 'context',
  name: 'Context',

  async getData(ctx: WidgetContext): Promise<ContextData | null> {
    const { context_window } = ctx.stdin;
    const usage = context_window?.current_usage;
    const contextSize = context_window?.context_window_size || 200000;

    if (!usage) {
      // Return default values when no usage data
      return {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        contextSize,
        percentage: 0,
      };
    }

    const inputTokens =
      usage.input_tokens +
      usage.cache_creation_input_tokens +
      usage.cache_read_input_tokens;
    const outputTokens = usage.output_tokens;
    const totalTokens = inputTokens + outputTokens;
    const percentage = calculatePercent(inputTokens, contextSize);

    return {
      inputTokens,
      outputTokens,
      totalTokens,
      contextSize,
      percentage,
    };
  },

  render(data: ContextData, ctx: WidgetContext): string {
    const parts: string[] = [];

    // Progress bar (narrower in compact mode)
    const barConfig = ctx.compact
      ? { ...DEFAULT_PROGRESS_BAR_CONFIG, width: COMPACT_PROGRESS_BAR_WIDTH }
      : undefined;
    parts.push(renderProgressBar(data.percentage, barConfig));

    // Percentage with color
    const percentColor = getColorForPercent(data.percentage);
    parts.push(colorize(`${data.percentage}%`, percentColor));

    // Token count - skip in compact mode
    if (!ctx.compact) {
      parts.push(
        `${formatTokens(data.inputTokens)}/${formatTokens(data.contextSize)}`
      );
    }

    return parts.join(getSeparator());
  },
};
