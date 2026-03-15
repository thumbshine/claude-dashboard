/**
 * Last Prompt widget - displays the most recent user prompt in the session
 * @handbook 3.3-widget-data-sources
 */

import type { Widget } from './base.js';
import type { WidgetContext, LastPromptData } from '../types.js';
import { colorize, getTheme } from '../utils/colors.js';
import { truncate } from '../utils/formatters.js';
import { parseTranscript, getLastUserPrompt } from '../utils/transcript-parser.js';

export const lastPromptWidget: Widget<LastPromptData> = {
  id: 'lastPrompt',
  name: 'Last Prompt',

  async getData(ctx: WidgetContext): Promise<LastPromptData | null> {
    const transcriptPath = ctx.stdin.transcript_path;
    if (!transcriptPath) return null;

    const transcript = await parseTranscript(transcriptPath);
    if (!transcript) return null;

    return getLastUserPrompt(transcript);
  },

  render(data: LastPromptData, _ctx: WidgetContext): string {
    const theme = getTheme();
    const timeStr = new Date(data.timestamp).toTimeString().slice(0, 5);
    return `${colorize('▸', theme.accent)} ${colorize(timeStr, theme.secondary)} ${truncate(data.text, 60)}`;
  },
};
