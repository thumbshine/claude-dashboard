/**
 * Agent mode widget — displays the active custom agent and/or current
 * subagent type, sourced from Claude Code stdin.
 *
 * - `stdin.agent.name`  → custom agent activated via `/agent <name>`  → 👤
 * - `stdin.agent_type`  → current session is a subagent of this type  → 🤖
 *
 * Returns null (graceful hide) when neither field is present.
 */

import type { Widget } from './base.js';
import type { WidgetContext, AgentModeData } from '../types.js';

export const agentModeWidget: Widget<AgentModeData> = {
  id: 'agentMode',
  name: 'Agent Mode',

  async getData(ctx: WidgetContext): Promise<AgentModeData | null> {
    const agentName = ctx.stdin.agent?.name?.trim();
    const agentType = ctx.stdin.agent_type?.trim();
    if (!agentName && !agentType) return null;
    return {
      agentName: agentName || undefined,
      agentType: agentType || undefined,
    };
  },

  render(data: AgentModeData): string {
    const parts: string[] = [];
    if (data.agentName) parts.push(`👤 ${data.agentName}`);
    if (data.agentType) parts.push(`🤖 ${data.agentType}`);
    return parts.join(' · ');
  },
};
