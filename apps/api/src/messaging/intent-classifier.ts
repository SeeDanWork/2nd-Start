export type SmsIntentType =
  | 'DISRUPTION_REPORT'
  | 'SWAP_REQUEST'
  | 'COVERAGE_REQUEST'
  | 'EXTRA_TIME_REQUEST'
  | 'PROPOSAL_ACCEPT'
  | 'PROPOSAL_DECLINE'
  | 'POLICY_CONFIRM'
  | 'STATUS_CHECK'
  | 'HELP'
  | 'STOP'
  | 'UNKNOWN';

export interface ClassifiedIntent {
  type: SmsIntentType;
  confidence: number;
  rawText: string;
  extractedDates?: string[];
  extractedKeywords?: string[];
}

// Day-of-week names for "next Monday" etc.
const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// Month names for "March 15" etc.
const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];
const MONTH_ABBREVS = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
];

interface PatternRule {
  type: SmsIntentType;
  patterns: RegExp[];
  confidence: number;
}

const RULES: PatternRule[] = [
  {
    type: 'HELP',
    patterns: [/^help$/i, /^\?$/, /^commands$/i, /^menu$/i],
    confidence: 1.0,
  },
  {
    type: 'STOP',
    patterns: [/\bstop\b/i, /\bunsubscribe\b/i, /\bopt\s*out\b/i],
    confidence: 1.0,
  },
  {
    type: 'PROPOSAL_ACCEPT',
    patterns: [
      /^accept$/i, /^yes$/i, /^approve$/i, /^ok$/i, /^okay$/i, /^yep$/i, /^yup$/i, /^y$/i,
      /^option\s*[1-3]$/i, /^pick\s*[1-3]$/i, /^choose\s*[1-3]$/i,
      /\baccept\b/i, /\bapprove\b/i,
    ],
    confidence: 0.9,
  },
  {
    type: 'PROPOSAL_DECLINE',
    patterns: [
      /^decline$/i, /^no$/i, /^reject$/i, /^n$/i, /^nope$/i, /^nah$/i,
      /\bdecline\b/i, /\breject\b/i,
    ],
    confidence: 0.9,
  },
  {
    type: 'DISRUPTION_REPORT',
    patterns: [
      /\bsick\b/i, /\bill\b/i, /\bemergency\b/i, /\bcan'?t\s+make\s+it\b/i,
      /\btravel\b/i, /\bunavailable\b/i, /\bcan'?t\s+do\b/i, /\bwon'?t\s+be\b/i,
    ],
    confidence: 0.8,
  },
  {
    type: 'SWAP_REQUEST',
    patterns: [/\bswap\b/i, /\btrade\b/i, /\bswitch\b/i, /\bexchange\b/i],
    confidence: 0.8,
  },
  {
    type: 'COVERAGE_REQUEST',
    patterns: [/\bcover\b/i, /\bneed\s+coverage\b/i, /\bcan\s+you\s+take\b/i, /\btake\s+the\s+kids?\b/i],
    confidence: 0.8,
  },
  {
    type: 'EXTRA_TIME_REQUEST',
    patterns: [/\bextra\s+time\b/i, /\bmore\s+time\b/i, /\bwant\b/i, /\bkeep\s+them\b/i],
    confidence: 0.7,
  },
  {
    type: 'POLICY_CONFIRM',
    patterns: [/\bconfirm\b/i, /\bsave\b/i, /\bkeep\b/i],
    confidence: 0.8,
  },
  {
    type: 'STATUS_CHECK',
    patterns: [
      /\bstatus\b/i, /\btonight\b/i, /\btoday\b/i, /\bschedule\b/i,
      /\bwho\s+has\b/i, /\bwhat'?s\b/i, /\bwhere\b/i, /\bwhen\b/i,
    ],
    confidence: 0.9,
  },
];

export function classifyIntent(text: string): ClassifiedIntent {
  const trimmed = text.trim();
  if (!trimmed) {
    return { type: 'UNKNOWN', confidence: 0, rawText: text };
  }

  const extractedDates = extractDates(trimmed);
  const extractedKeywords: string[] = [];

  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(trimmed)) {
        extractedKeywords.push(pattern.source);
        return {
          type: rule.type,
          confidence: rule.confidence,
          rawText: text,
          extractedDates: extractedDates.length > 0 ? extractedDates : undefined,
          extractedKeywords,
        };
      }
    }
  }

  return {
    type: 'UNKNOWN',
    confidence: 0,
    rawText: text,
    extractedDates: extractedDates.length > 0 ? extractedDates : undefined,
  };
}

/**
 * Extract option number from text like "option 2", "pick 1", "2"
 */
export function extractOptionNumber(text: string): number | null {
  const match = text.trim().match(/^(?:option|pick|choose)?\s*([1-3])$/i);
  if (match) return parseInt(match[1], 10);
  return null;
}

function extractDates(text: string): string[] {
  const dates: string[] = [];
  const now = new Date();
  const currentYear = now.getFullYear();

  // Pattern: MM/DD or MM-DD or MM/DD/YYYY
  const slashPattern = /(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/g;
  let match;
  while ((match = slashPattern.exec(text)) !== null) {
    const month = parseInt(match[1], 10);
    const day = parseInt(match[2], 10);
    const year = match[3] ? (match[3].length === 2 ? 2000 + parseInt(match[3], 10) : parseInt(match[3], 10)) : currentYear;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      dates.push(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
    }
  }

  // Pattern: "Month Day" (e.g., "March 15")
  for (let i = 0; i < MONTH_NAMES.length; i++) {
    const monthName = MONTH_NAMES[i];
    const monthAbbrev = MONTH_ABBREVS[i];
    const monthPattern = new RegExp(
      `(?:${monthName}|${monthAbbrev})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?`,
      'gi',
    );
    while ((match = monthPattern.exec(text)) !== null) {
      const day = parseInt(match[1], 10);
      if (day >= 1 && day <= 31) {
        dates.push(`${currentYear}-${String(i + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
      }
    }
  }

  // Pattern: "tomorrow"
  if (/\btomorrow\b/i.test(text)) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    dates.push(tomorrow.toISOString().split('T')[0]);
  }

  // Pattern: "next Monday", "next Friday" etc.
  for (let i = 0; i < DAY_NAMES.length; i++) {
    const dayPattern = new RegExp(`\\bnext\\s+${DAY_NAMES[i]}\\b`, 'i');
    if (dayPattern.test(text)) {
      const target = new Date(now);
      const currentDay = target.getDay();
      let daysAhead = i - currentDay;
      if (daysAhead <= 0) daysAhead += 7;
      target.setDate(target.getDate() + daysAhead);
      dates.push(target.toISOString().split('T')[0]);
    }
  }

  // Deduplicate
  return [...new Set(dates)];
}
