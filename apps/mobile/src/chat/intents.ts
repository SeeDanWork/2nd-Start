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
  {
    patterns: [/\bsick\b/i, /\bill\b/i, /\bfever\b/i, /\bvomit/i, /\bnot\s+feeling\s+well\b/i],
    actionType: 'illness_protocol',
  },
  {
    patterns: [/\bclos(ed|ure|ing)\b/i, /\bno\s+school\b/i, /\bschool\s+closed\b/i, /\bdaycare\s+closed\b/i],
    actionType: 'school_closure',
  },
  {
    patterns: [/\bemergency\b/i, /\bcancel/i, /\bdisrupt/i, /\bunexpected\b/i],
    actionType: 'disruption_report',
  },
  {
    patterns: [/\bmulti.?child\b/i, /\bsibling/i, /\bchildren.+ages?\b/i, /\bhow.+scoring\b/i],
    actionType: 'explain_multi_child',
  },
  {
    patterns: [/\bhandoff\b/i, /\bpick.?up\b/i, /\bdrop.?off\b/i, /\btransport/i],
    actionType: 'handoff_logistics',
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
