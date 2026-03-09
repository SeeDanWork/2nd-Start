import { MessageIntent } from '../enums';
import { ParsedIntent } from '../types';

/**
 * Regex-based intent parser for natural-language co-parenting messages.
 * Processes patterns in priority order (first match wins).
 * Returns a ParsedIntent with confidence score and extracted entities.
 */
export function parseIntent(text: string): ParsedIntent {
  const trimmed = text.trim();
  const entities: Record<string, string> = {};

  // Extract entities regardless of intent
  extractDateEntities(trimmed, entities);
  extractChildName(trimmed, entities);

  // Detect intent (priority order — first match wins)
  const detected = detectIntent(trimmed);

  return {
    intent: detected.intent,
    confidence: detected.confidence,
    entities,
    rawText: text,
  };
}

// ─── Intent Detection ────────────────────────────────────────

interface IntentMatch {
  intent: MessageIntent;
  confidence: number;
}

function detectIntent(text: string): IntentMatch {
  // 1. HELP — starts with help keyword or question mark
  if (/^(help|\?|commands|what can|how do i)/i.test(text)) {
    return { intent: MessageIntent.HELP, confidence: 0.95 };
  }

  // 2. APPROVE — exact short affirmations
  if (/^(yes|yep|yeah|approve|ok|okay|agreed|accept|confirm|sounds good|sure|go ahead|absolutely|definitely)$/i.test(text)) {
    return { intent: MessageIntent.APPROVE, confidence: 0.95 };
  }
  // APPROVE — starts with affirmation but has more text
  if (/^(yes|yep|yeah|approve|ok|okay|agreed|accept|confirm|sounds good|sure|go ahead|absolutely|definitely)\b/i.test(text)) {
    return { intent: MessageIntent.APPROVE, confidence: 0.8 };
  }

  // 3. DECLINE — exact short negations
  if (/^(no|nope|nah|decline|reject|deny|not ok|disagree|can't|cant|won't|wont|won't work|pass)$/i.test(text)) {
    return { intent: MessageIntent.DECLINE, confidence: 0.95 };
  }
  // DECLINE — starts with negation but has more text
  if (/^(no|nope|nah|decline|reject|deny|not ok|disagree|can't|cant|won't|wont|won't work|pass)\b/i.test(text)) {
    return { intent: MessageIntent.DECLINE, confidence: 0.8 };
  }

  // 4. VIEW_SCHEDULE — wants a link or to view
  if (/(show me|send link|schedule link|view schedule|see the schedule|send me the)/i.test(text)) {
    return { intent: MessageIntent.VIEW_SCHEDULE, confidence: 0.85 };
  }

  // 5. REPORT_ILLNESS — health-related keywords
  if (/(sick|ill\b|fever|not feeling well|threw up|vomiting|doctor|stomach|flu|covid|infection)/i.test(text)) {
    return { intent: MessageIntent.REPORT_ILLNESS, confidence: 0.85 };
  }

  // 6. REQUEST_SWAP — swap/trade/cover keywords
  if (/(swap|switch|trade|exchange days|can you take|can (he|she) take|take them|cover for)/i.test(text)) {
    return { intent: MessageIntent.REQUEST_SWAP, confidence: 0.85 };
  }

  // 7. CONFIRM_SCHEDULE — schedule query keywords
  if (/(who has|whose turn|who's got|what's the schedule|show schedule|this week|next week|who gets)/i.test(text)) {
    return { intent: MessageIntent.CONFIRM_SCHEDULE, confidence: 0.85 };
  }

  // 8. REPORT_DISRUPTION — school/weather closures
  if (/(school closed|snow day|no school|cancelled|closure|holiday|weather|closed tomorrow|early dismissal)/i.test(text)) {
    return { intent: MessageIntent.REPORT_DISRUPTION, confidence: 0.85 };
  }

  // 9. UNKNOWN — nothing matched
  return { intent: MessageIntent.UNKNOWN, confidence: 0.3 };
}

// ─── Entity Extraction ──────────────────────────────────────

function extractDateEntities(text: string, entities: Record<string, string>): void {
  // Days of week
  const dayMatch = text.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i);
  if (dayMatch) {
    entities.day = dayMatch[1].toLowerCase();
  }

  // Relative dates
  const relMatch = text.match(/\b(today|tomorrow|tonight|this weekend|next week|next weekend)\b/i);
  if (relMatch) {
    entities.relative_date = relMatch[1].toLowerCase();
  }

  // Specific dates (e.g. 3/15, 12/25)
  const dateMatch = text.match(/\b(\d{1,2}\/\d{1,2})\b/);
  if (dateMatch) {
    entities.date = dateMatch[1];
  }
}

function extractChildName(text: string, entities: Record<string, string>): void {
  // Match "Name is sick/ill/not feeling well" patterns
  const sickMatch = text.match(/\b([A-Z][a-z]+)\s+is\s+(sick|ill|not feeling well|throwing up|vomiting)/i);
  if (sickMatch) {
    entities.child_name = sickMatch[1];
  }

  // Match "Name has a fever/flu/stomach" patterns
  const hasMatch = text.match(/\b([A-Z][a-z]+)\s+has\s+a?\s*(fever|flu|stomach|cold|covid|infection)/i);
  if (hasMatch) {
    entities.child_name = hasMatch[1];
  }

  // Match "Name threw up" pattern
  const threwMatch = text.match(/\b([A-Z][a-z]+)\s+threw\s+up/i);
  if (threwMatch) {
    entities.child_name = threwMatch[1];
  }
}
