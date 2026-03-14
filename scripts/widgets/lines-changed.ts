/**
 * Lines Changed widget - displays uncommitted lines added/removed via git diff
 * @handbook 3.3-widget-data-sources
 */

import { execFile } from 'child_process';
import type { Widget } from './base.js';
import type { WidgetContext, LinesChangedData } from '../types.js';
import { colorize, getTheme } from '../utils/colors.js';

/**
 * Run git command asynchronously with timeout
 */
function execGit(args: string[], cwd: string, timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('git', ['--no-optional-locks', ...args], {
      cwd,
      encoding: 'utf-8',
      timeout,
    }, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout);
    });
  });
}

export const linesChangedWidget: Widget<LinesChangedData> = {
  id: 'linesChanged',
  name: 'Lines Changed',

  async getData(ctx: WidgetContext): Promise<LinesChangedData | null> {
    const cwd = ctx.stdin.workspace?.current_dir;
    if (!cwd) return null;

    try {
      const output = await execGit(['diff', 'HEAD', '--shortstat'], cwd, 1000);
      if (!output.trim()) return null;

      const insertMatch = output.match(/(\d+) insertion/);
      const deleteMatch = output.match(/(\d+) deletion/);
      const added = insertMatch ? parseInt(insertMatch[1], 10) : 0;
      const removed = deleteMatch ? parseInt(deleteMatch[1], 10) : 0;

      if (added === 0 && removed === 0) return null;

      return { added, removed };
    } catch {
      return null;
    }
  },

  render(data: LinesChangedData, _ctx: WidgetContext): string {
    const theme = getTheme();
    const parts: string[] = [];
    if (data.added > 0) parts.push(colorize(`+${data.added}`, theme.safe));
    if (data.removed > 0) parts.push(colorize(`-${data.removed}`, theme.danger));
    return parts.join(' ');
  },
};
