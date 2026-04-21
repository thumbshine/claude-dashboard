/**
 * Teamkit widget - displays teamkit identity (emoji + author)
 *
 * Shown only when a teamkit project is detected (teamkit/sprint-status.yaml
 * exists at project root). Author is parsed from CLAUDE.local.md.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { Widget } from './base.js';
import type { WidgetContext, TeamkitData } from '../types.js';

const AUTHOR_REGEX = /^\s*-\s*author\s*:\s*(\S+)/im;

export const teamkitWidget: Widget<TeamkitData> = {
  id: 'teamkit',
  name: 'Teamkit',

  async getData(ctx: WidgetContext): Promise<TeamkitData | null> {
    const root = ctx.stdin.workspace?.project_dir ?? ctx.stdin.workspace?.current_dir;
    if (!root) return null;

    if (!existsSync(join(root, 'teamkit', 'sprint-status.yaml'))) return null;

    const localPath = join(root, 'CLAUDE.local.md');
    if (!existsSync(localPath)) return null;

    try {
      const match = readFileSync(localPath, 'utf-8').match(AUTHOR_REGEX);
      if (!match) return null;
      return { author: match[1] };
    } catch {
      return null;
    }
  },

  render(data: TeamkitData): string {
    return `🧰 ${data.author}`;
  },
};
