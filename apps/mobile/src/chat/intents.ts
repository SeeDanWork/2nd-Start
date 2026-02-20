import { StructuredAction, ChatContext } from './types';

const KEYWORD_MAP: Array<{ patterns: RegExp[]; actionType: string }> = [
  {
    patterns: [/\bswap\b/i, /\bswitch\b/i, /\bchange\s+day/i, /\btrade\b/i],
    actionType: 'propose_swap',
  },
  {
    patterns: [/\blate\b/i, /\brunning\s+late\b/i, /\bdelayed\b/i],
    actionType: 'notify_late',
  },
  {
    patterns: [/\bwhy\b/i, /\bexplain\b/i, /\bhow\s+come\b/i, /\breason\b/i],
    actionType: 'explain_schedule',
  },
  {
    patterns: [/\bpack\b/i, /\bbring\b/i, /\bremember\b/i, /\bdon'?t\s+forget\b/i],
    actionType: 'create_task',
  },
  {
    patterns: [/\bschedule\b/i, /\bcalendar\b/i, /\bview\b/i],
    actionType: 'view_schedule',
  },
];

/**
 * Resolve user text input to a structured action.
 * LLM swap point: Replace this function body with a Claude API call.
 * Same signature, same return type.
 */
export function resolveIntent(
  text: string,
  _context: ChatContext,
): StructuredAction | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  for (const { patterns, actionType } of KEYWORD_MAP) {
    for (const pattern of patterns) {
      if (pattern.test(trimmed)) {
        return { type: actionType, params: { rawText: trimmed } };
      }
    }
  }

  return null;
}
