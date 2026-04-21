/**
 * Model widget - displays current Claude model id (teamkit fork).
 *
 * Diverges from upstream: outputs the canonical model id (e.g.
 * `claude-opus-4-7`) instead of the abbreviated `display_name`, and
 * intentionally omits the effort level badge — sarah prefers the raw id,
 * no `(X)` suffix. Fast mode (↯) is kept for forward-compat (no-op on 4.7+).
 *
 * @handbook 3.3-widget-data-sources
 * @tested scripts/__tests__/widgets.test.ts
 */

import { readFile, stat } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import type { Widget } from './base.js';
import type { WidgetContext, ModelData, EffortLevel } from '../types.js';
import { RESET, getTheme } from '../utils/colors.js';
import { isZaiProvider } from '../utils/provider.js';

const EFFORT_LEVELS = new Set<string>(['xhigh', 'high', 'medium', 'low']);

function isEffortLevel(value: unknown): value is EffortLevel {
  return typeof value === 'string' && EFFORT_LEVELS.has(value);
}

interface ModelSettings {
  effortLevel: EffortLevel;
  fastMode: boolean;
}

/**
 * Fallback effort when settings.json is absent or lacks `effortLevel`.
 * Mirrors Claude Code's runtime defaults so the badge matches actual behavior
 * for users who never ran `/effort`. Keep in sync with upstream:
 *   Opus → xhigh, Sonnet → medium.
 * Haiku has no effort tier (render() hides the badge); the `'high'` fallback
 * is a safety net for unknown model IDs.
 */
export function getDefaultEffort(modelId: string): EffortLevel {
  if (modelId.includes('opus')) return 'xhigh';
  if (modelId.includes('sonnet')) return 'medium';
  return 'high';
}

let settingsCache: { rawEffort: unknown; fastMode: boolean; mtime: number } | null = null;

async function getModelSettings(modelId: string): Promise<ModelSettings> {
  const defaultEffort = getDefaultEffort(modelId);
  const settingsPath = join(homedir(), '.claude', 'settings.json');

  try {
    const fileStat = await stat(settingsPath);
    if (settingsCache && settingsCache.mtime === fileStat.mtimeMs) {
      return {
        effortLevel: isEffortLevel(settingsCache.rawEffort) ? settingsCache.rawEffort : defaultEffort,
        fastMode: settingsCache.fastMode,
      };
    }
    const content = await readFile(settingsPath, 'utf-8');
    const settings = JSON.parse(content);
    const rawEffort = settings.effortLevel;
    const fastMode = settings.fastMode === true;
    settingsCache = { mtime: fileStat.mtimeMs, rawEffort, fastMode };
    return {
      effortLevel: isEffortLevel(rawEffort) ? rawEffort : defaultEffort,
      fastMode,
    };
  } catch {
    settingsCache = null;
  }

  const envEffort = process.env.CLAUDE_CODE_EFFORT_LEVEL;
  if (isEffortLevel(envEffort)) {
    return { effortLevel: envEffort, fastMode: false };
  }

  return { effortLevel: defaultEffort, fastMode: false };
}

export const modelWidget: Widget<ModelData> = {
  id: 'model',
  name: 'Model',

  async getData(ctx: WidgetContext): Promise<ModelData | null> {
    const { model } = ctx.stdin;
    const modelId = model?.id || '';
    const { effortLevel, fastMode } = await getModelSettings(modelId);

    return {
      id: model?.id || '',
      displayName: model?.display_name || '-',
      effortLevel,
      fastMode,
    };
  },

  render(data: ModelData): string {
    const icon = isZaiProvider() ? '🟠' : '◆';
    const name = data.id || data.displayName || '-';
    const fastIndicator = data.id.includes('opus') && data.fastMode ? ' ↯' : '';

    return `${getTheme().model}${icon} ${name}${fastIndicator}${RESET}`;
  },
};
