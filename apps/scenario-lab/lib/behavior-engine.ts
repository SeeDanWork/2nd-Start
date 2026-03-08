// ── Persona Behavior Engine ──────────────────────────────────
// Determines how personas automatically respond to proposals,
// disruptions, and schedule changes.

import { ParentPersona, PARENT_PERSONAS, InteractionArchetype, INTERACTION_ARCHETYPES } from './personas';
import { ScenarioEvent, DISRUPTION_RESPONSE_PATTERNS, DisruptionResponsePattern } from './scenarios';

// ── Response Timing ──

const RESPONSE_DELAYS: Record<string, { min: number; max: number }> = {
  fast: { min: 5, max: 30 },          // seconds
  medium: { min: 60, max: 300 },       // 1-5 minutes
  slow: { min: 600, max: 1800 },       // 10-30 minutes
  very_slow: { min: 1800, max: 7200 }, // 30 min - 2 hours
};

export function getResponseDelay(persona: ParentPersona): number {
  const range = RESPONSE_DELAYS[persona.behavior.response_speed];
  return range.min + Math.random() * (range.max - range.min);
}

// ── Decision Engine ──

export type Decision = 'accept' | 'reject' | 'counter' | 'ignore' | 'delay';

export interface DecisionResult {
  decision: Decision;
  confidence: number;
  reasoning: string;
  delay_seconds: number;
  counter_text?: string;
  injected_events?: ScenarioEvent[];
}

/**
 * Evaluate how a persona would respond to a proposal.
 *
 * @param persona - The parent persona making the decision
 * @param fairnessDeviation - How far the proposal deviates from target split (0-100)
 * @param transitionIncrease - Whether the proposal increases weekly transitions
 * @param isDisruptionRelated - Whether this is responding to a disruption
 * @param currentDay - Current simulation day (for event injection timing)
 */
export function evaluateProposal(
  persona: ParentPersona,
  fairnessDeviation: number,
  transitionIncrease: boolean,
  isDisruptionRelated: boolean,
  currentDay: number,
): DecisionResult {
  const b = persona.behavior;
  const delay = getResponseDelay(persona);

  // ── Avoidant: may ignore ──
  if (b.response_speed === 'very_slow' && Math.random() < 0.4) {
    return {
      decision: 'ignore',
      confidence: 0.6,
      reasoning: 'Avoidant persona — did not respond within time window',
      delay_seconds: delay,
    };
  }

  // ── Calculate acceptance score ──
  let score = b.proposal_acceptance_bias;

  // Fairness sensitivity penalty
  if (fairnessDeviation > 5) {
    const fairnessPenalty = (fairnessDeviation / 100) * (b.fairness_sensitivity / 5);
    score -= fairnessPenalty;
  }

  // Transition increase penalty for rigid personas
  if (transitionIncrease) {
    score -= (b.schedule_rigidity / 5) * 0.2;
  }

  // Disruption bonus (most personas more accepting during disruptions)
  if (isDisruptionRelated && b.conflict_level < 4) {
    score += 0.15;
  }

  // Conflict level penalty
  score -= (b.conflict_level / 5) * 0.15;

  // Logistics tolerance bonus
  score += (b.logistics_tolerance / 5) * 0.1;

  // Clamp
  score = Math.max(0, Math.min(1, score));

  // ── Decision ──
  const roll = Math.random();
  const injectedEvents: ScenarioEvent[] = [];

  // Gaming injection
  if (Math.random() < b.gaming_probability) {
    injectedEvents.push({
      type: 'extra_time_request',
      day: currentDay + 1 + Math.floor(Math.random() * 3),
      parent: 'parent_a', // Will be overridden by caller
      description: `${persona.name} attempts to gain additional time`,
    });
  }

  if (roll < score) {
    return {
      decision: 'accept',
      confidence: score,
      reasoning: `${persona.name}: Score ${(score * 100).toFixed(0)}% — accepted proposal`,
      delay_seconds: delay,
      injected_events: injectedEvents.length > 0 ? injectedEvents : undefined,
    };
  }

  // Counter vs reject
  const counterProbability = b.fairness_sensitivity > 3 ? 0.4 : 0.2;
  if (roll < score + counterProbability * (1 - score)) {
    return {
      decision: 'counter',
      confidence: 1 - score,
      reasoning: `${persona.name}: Score ${(score * 100).toFixed(0)}% — counter-proposing`,
      delay_seconds: delay,
      counter_text: generateCounterText(persona, fairnessDeviation),
      injected_events: injectedEvents.length > 0 ? injectedEvents : undefined,
    };
  }

  return {
    decision: 'reject',
    confidence: 1 - score,
    reasoning: `${persona.name}: Score ${(score * 100).toFixed(0)}% — rejected proposal`,
    delay_seconds: delay,
    injected_events: injectedEvents.length > 0 ? injectedEvents : undefined,
  };
}

/**
 * Evaluate how a persona responds to a disruption event.
 */
export function evaluateDisruption(
  persona: ParentPersona,
  event: ScenarioEvent,
  currentDay: number,
): DecisionResult {
  const b = persona.behavior;
  const delay = getResponseDelay(persona);

  // High conflict personas use disruptions as leverage
  if (b.conflict_level >= 4 && Math.random() < 0.5) {
    return {
      decision: 'counter',
      confidence: 0.7,
      reasoning: `${persona.name}: Using disruption as leverage — demands concession`,
      delay_seconds: delay,
      counter_text: 'I can only help if we adjust the schedule in my favor next week',
      injected_events: [
        {
          type: 'extra_time_request',
          day: currentDay + 2,
          description: `${persona.name} leverages disruption for extra time`,
        },
      ],
    };
  }

  // Flexible personas accommodate easily
  if (b.logistics_tolerance >= 4) {
    return {
      decision: 'accept',
      confidence: 0.9,
      reasoning: `${persona.name}: Flexible — accommodating disruption easily`,
      delay_seconds: delay * 0.5, // faster response to urgent matters
    };
  }

  // Rigid personas resist changes even for disruptions
  if (b.schedule_rigidity >= 4) {
    return {
      decision: 'reject',
      confidence: 0.6,
      reasoning: `${persona.name}: Rigid — resisting disruption-driven change`,
      delay_seconds: delay,
    };
  }

  // Default: accept with slight delay
  return {
    decision: 'accept',
    confidence: 0.7,
    reasoning: `${persona.name}: Cooperating with disruption response`,
    delay_seconds: delay,
  };
}

// ── Helper: generate counter-proposal text ──

function generateCounterText(persona: ParentPersona, fairnessDeviation: number): string {
  const b = persona.behavior;

  if (b.fairness_sensitivity >= 4 && fairnessDeviation > 5) {
    return `I need compensation — the split is already ${fairnessDeviation}% off target. I want an extra day next week.`;
  }
  if (b.schedule_rigidity >= 4) {
    return 'I can only agree if we keep the same transition days. No changes to pickup times.';
  }
  if (b.gaming_probability > 0.5) {
    return "I'll agree to this swap if I also get the following weekend.";
  }
  if (b.conflict_level >= 4) {
    return "This doesn't work for me. You need to find another solution.";
  }
  return 'Can we adjust the timing? I have a conflict with the proposed schedule.';
}

// ── Automated Message Generation ──

/**
 * Generate a realistic SMS message from a persona for a given situation.
 */
export function generatePersonaMessage(
  persona: ParentPersona,
  situation: 'greeting' | 'proposal_response' | 'disruption_report' | 'complaint' | 'swap_request',
  context?: { fairnessDeviation?: number; eventType?: string },
): string {
  const b = persona.behavior;

  switch (situation) {
    case 'greeting':
      if (b.conflict_level <= 2) return 'Hi, checking in about the schedule this week.';
      if (b.conflict_level <= 3) return 'Need to discuss the schedule.';
      return 'We need to talk about the schedule. Again.';

    case 'proposal_response':
      if (b.proposal_acceptance_bias > 0.7) return 'That works for me. Thanks for being flexible.';
      if (b.fairness_sensitivity >= 4) return `I need to see the fairness numbers before I agree to this.`;
      if (b.conflict_level >= 4) return 'No. This puts me at a disadvantage.';
      return "Let me think about this and get back to you.";

    case 'disruption_report':
      if (b.logistics_tolerance >= 4) return `${context?.eventType || 'Something came up'} — I can cover if needed.`;
      if (b.conflict_level >= 4) return `${context?.eventType || 'This happened'} and it's your responsibility to handle it.`;
      return `${context?.eventType || 'Heads up'} — we need to figure out coverage.`;

    case 'complaint':
      if (b.fairness_sensitivity >= 4) return `The split is ${context?.fairnessDeviation || 'way'}% off. This needs to be fixed immediately.`;
      if (b.conflict_level >= 4) return 'This schedule is unfair and I want it reviewed.';
      return 'I have some concerns about how the schedule has been working lately.';

    case 'swap_request':
      if (b.proposal_acceptance_bias > 0.7) return 'Would it be possible to swap days this week? Happy to make it up.';
      if (b.gaming_probability > 0.5) return 'I need next Tuesday. I can give you a day sometime later.';
      return 'Can we swap a day this week? Something came up.';

    default:
      return 'Hi';
  }
}

// ── Reactive Setup Engine ────────────────────────────────────
// Reads the system's actual response, classifies what's being ASKED
// (not what's being acknowledged), and generates a compound answer
// covering all unanswered questions in the message.
//
// Key insight: The LLM onboarding asks freeform questions and often
// combines multiple asks in one message. We must:
// 1. Focus on the QUESTION part (near "?", after "now", at end)
// 2. Track what we've already answered to avoid loops
// 3. Generate compound answers when multiple things are asked

import { ScenarioConfig, ChildConfig } from './types';

const DAY_MAP = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const TEMPLATE_NAMES: Record<string, string> = {
  'alternating_weeks': 'We alternate full weeks, switching on Sundays',
  '2-2-3': 'A 2-2-3 rotation — 2 days with me, 2 with them, then 3 with me, and it flips',
  '3-4-4-3': 'A 3-4-4-3 pattern where we split the week',
  '5-2': 'I have them weekdays, the other parent gets weekends',
  'every_other_weekend': 'I have them most of the time, other parent gets every other weekend',
  'custom': 'We work it out week by week, no fixed pattern',
};

export type OnboardingTopic =
  | 'greeting'        // welcome / initial prompt
  | 'children_count'  // how many children
  | 'children_ages'   // ages of children
  | 'arrangement'     // custody arrangement type
  | 'locked_days'     // which days are fixed
  | 'weekends'        // how weekends work
  | 'split'           // target time split
  | 'exchange'        // how handoffs work
  | 'distance'        // distance between homes
  | 'phone'           // co-parent phone number
  | 'frustrations'    // what they want to improve
  | 'confirm'         // review and confirm
  | 'confirmed'       // setup complete
  | 'unknown';

// ── Question-focused classifier ──────────────────────────────
// Splits the message into sentences, finds the ones that are
// questions (contain "?"), and classifies based on those.
// Falls back to full-text scan if no questions found.

interface TopicPattern {
  topic: OnboardingTopic;
  patterns: RegExp[];
  // Higher priority = checked first (for question sentences)
  priority: number;
}

const TOPIC_PATTERNS: TopicPattern[] = [
  // Terminal states — always check full text
  { topic: 'confirmed', priority: 100, patterns: [
    /all set/i, /family.{0,15}created/i, /schedule.{0,15}created/i,
    /you've joined/i, /you\'ve joined/i, /we'll generate/i,
    /type help/i, /available commands/i,
    /invite has been sent/i, /you can now view/i,
    /schedule is .{0,10}(set up|working|ready|live)/i,
    /upcoming exchanges/i,
  ]},
  { topic: 'confirm', priority: 95, patterns: [
    /reply yes/i, /yes to confirm/i, /look right\??/i, /look good\??/i,
    /here's your setup/i, /here is your setup/i,
  ]},

  // Question-type patterns (ordered by specificity)
  { topic: 'distance', priority: 80, patterns: [
    /how far apart/i, /how far .* live/i, /distance/i,
    /how many miles/i, /miles apart/i, /apart .* live/i,
  ]},
  { topic: 'phone', priority: 79, patterns: [
    /phone number/i, /co-parent's (phone|number)/i,
    /other parent's (phone|number)/i, /sharing .* number/i,
    /their number/i,
  ]},
  { topic: 'exchange', priority: 78, patterns: [
    /handoff/i, /hand.?off/i, /exchange/i, /drop.?off/i, /pick.?up/i,
    /how .* switch/i, /when .* switch/i, /day .* switch/i,
  ]},
  { topic: 'frustrations', priority: 77, patterns: [
    /frustrat/i, /what would you change/i, /what .* improve/i,
    /what .* better/i, /what .* concern/i, /what .* goal/i,
  ]},
  { topic: 'weekends', priority: 76, patterns: [
    /how .* weekend/i, /what .* weekend/i, /weekend .* work/i,
    /weekend .* alternate/i,
  ]},
  { topic: 'split', priority: 75, patterns: [
    /time split/i, /what .* split/i, /50.50/i, /60.40/i, /70.30/i,
    /what overall/i, /percent/i,
  ]},
  { topic: 'locked_days', priority: 74, patterns: [
    /specific days/i, /specific nights/i, /always .* with (you|one parent)/i,
    /locked/i, /fixed day/i, /midweek/i,
    /any days that are always/i, /any .* nights that/i, /always with the other/i,
  ]},
  { topic: 'arrangement', priority: 73, patterns: [
    /how does custody/i, /custody .* work/i, /how .* custody/i,
    /arrangement/i, /alternate weeks/i, /current .* schedule/i,
    /how .* work now/i, /what's happening now/i,
    /describe .* current/i, /tell me .* custody/i,
  ]},
  { topic: 'children_ages', priority: 72, patterns: [
    /what are their ages/i, /how old/i, /their ages/i,
  ]},
  { topic: 'children_count', priority: 71, patterns: [
    /how many children/i, /how many kids/i, /how many .* co-parent/i,
  ]},
  { topic: 'greeting', priority: 70, patterns: [
    /welcome/i, /let'?s start/i, /help .* set up/i,
    /i'm adcp/i, /i help parents/i,
  ]},
];

/**
 * Extract question sentences from a message (sentences ending with ?).
 * If the message has no explicit questions, take the last 2 sentences.
 */
function extractQuestionParts(text: string): string {
  // Split on sentence boundaries
  const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
  const questions = sentences.filter(s => s.includes('?'));

  if (questions.length > 0) {
    return questions.join(' ');
  }
  // No explicit questions — use the last portion of the message
  return sentences.slice(-2).join(' ');
}

/**
 * Classify what the system is asking. Focuses on the question part
 * of the message to avoid matching on acknowledgments of previous answers.
 */
export function classifySystemMessage(text: string): OnboardingTopic {
  if (!text || text.trim().length === 0) return 'unknown';

  const full = text.toLowerCase();

  // Terminal states check full text (these are definitive)
  for (const tp of TOPIC_PATTERNS.filter(p => p.priority >= 95)) {
    if (tp.patterns.some(p => p.test(full))) return tp.topic;
  }

  // For everything else, focus on the question portion
  const questionPart = extractQuestionParts(text).toLowerCase();

  // Sort by priority descending and check question part
  const sorted = TOPIC_PATTERNS
    .filter(p => p.priority < 95)
    .sort((a, b) => b.priority - a.priority);

  for (const tp of sorted) {
    if (tp.patterns.some(p => p.test(questionPart))) {
      return tp.topic;
    }
  }

  // Fallback: scan full text but with lower confidence topics
  for (const tp of sorted) {
    if (tp.patterns.some(p => p.test(full))) {
      return tp.topic;
    }
  }

  return 'unknown';
}

/**
 * Detect ALL topics being asked in a message (for compound answers).
 * Returns topics in order of appearance.
 */
export function classifyAllTopics(text: string): OnboardingTopic[] {
  if (!text || text.trim().length === 0) return ['unknown'];

  const full = text.toLowerCase();
  const questionPart = extractQuestionParts(text).toLowerCase();

  // Check terminal states first
  for (const tp of TOPIC_PATTERNS.filter(p => p.priority >= 95)) {
    if (tp.patterns.some(p => p.test(full))) return [tp.topic];
  }

  // Find all topics in the question part
  const found: OnboardingTopic[] = [];
  const sorted = TOPIC_PATTERNS
    .filter(p => p.priority < 95)
    .sort((a, b) => b.priority - a.priority);

  for (const tp of sorted) {
    if (tp.patterns.some(p => p.test(questionPart))) {
      found.push(tp.topic);
    }
  }

  return found.length > 0 ? found : ['unknown'];
}

function describeChildren(children: ChildConfig[]): string {
  if (children.length === 1) {
    return `I have 1 child, ${children[0].name}, age ${children[0].age}`;
  }
  const ages = children.map(c => `${c.name} is ${c.age}`).join(' and ');
  return `I have ${children.length} kids. ${ages}`;
}

function describeLockedNights(config: ScenarioConfig): string {
  if (config.lockedNights.length === 0) return 'No fixed days — during my week I have them all 7 days';
  const parts = config.lockedNights.map(ln => {
    const days = ln.daysOfWeek.map(d => DAY_MAP[d]).join(' and ');
    return `${days} are always with ${ln.parent === 'parent_a' ? 'me' : 'the other parent'}`;
  });
  return parts.join('. ');
}

function singleTopicAnswer(
  topic: OnboardingTopic,
  persona: ParentPersona,
  config: ScenarioConfig,
): string {
  const b = persona.behavior;

  switch (topic) {
    case 'greeting':
    case 'children_count':
      return describeChildren(config.children);

    case 'children_ages':
      return config.children.map(c => c.age).join(', ');

    case 'arrangement': {
      const base = TEMPLATE_NAMES[config.template] || config.template;
      if (b.conflict_level >= 4) return `${base}. It doesn't really work but that's what we have.`;
      if (b.fairness_sensitivity >= 4) return `${base}. I track the days carefully to keep it balanced.`;
      return base;
    }

    case 'locked_days': {
      const days = describeLockedNights(config);
      if (b.schedule_rigidity >= 4 && config.lockedNights.length > 0) return `${days}. These are non-negotiable.`;
      return days;
    }

    case 'weekends':
      if (config.template === 'alternating_weeks') return 'Weekends go with the week — whoever has the week has the full weekend too.';
      if (config.template === 'every_other_weekend') return 'Other parent gets every other weekend.';
      if (config.template === '2-2-3') return 'Weekends alternate as part of the 2-2-3 rotation.';
      return 'We alternate weekends.';

    case 'split': {
      const split = `${config.targetSplit}/${100 - config.targetSplit}`;
      if (b.fairness_sensitivity >= 4) return `We want ${split}. I need this tracked carefully.`;
      if (b.gaming_probability > 0.5) return `${split}, though I'd like more time.`;
      return `We're aiming for ${split}`;
    }

    case 'exchange':
      if (b.logistics_tolerance >= 4) return 'Usually school drop-off on Mondays, but we\'re flexible about it.';
      if (b.schedule_rigidity >= 4) return 'School drop-off Monday mornings. Same time every week.';
      return 'We usually do school drop-off on Monday mornings.';

    case 'distance':
      if (config.distanceMiles > 30) return `About ${config.distanceMiles} miles apart. It makes handoffs tough.`;
      return `We live about ${config.distanceMiles} miles apart`;

    case 'phone':
      return `Their number is ${config.parentB.phone}`;

    case 'frustrations':
      if (b.fairness_sensitivity >= 4) return 'Making sure the time split is actually fair and tracked properly.';
      if (b.conflict_level >= 4) return 'Reducing conflict. The other parent fights me on everything.';
      if (b.schedule_rigidity >= 4) return 'Keeping a consistent routine for the kids.';
      if (b.logistics_tolerance >= 4) return 'Being flexible when things come up last minute.';
      if (b.gaming_probability > 0.5) return 'Getting a schedule that works better for my situation.';
      if (b.response_speed === 'very_slow') return 'Just want something simple that works.';
      return 'Having a fair schedule that works for everyone.';

    case 'confirm':
      return 'Yes, that looks right!';

    case 'confirmed':
      return '';

    case 'unknown':
      return '';
  }
}

/**
 * Generate a reactive answer based on what the system actually asked.
 * Handles compound questions by answering multiple topics at once.
 * Skips topics already in the answeredTopics set.
 */
export function generateReactiveAnswer(
  topic: OnboardingTopic,
  persona: ParentPersona,
  config: ScenarioConfig,
  answeredTopics?: Set<string>,
): string {
  // If the primary topic was already answered, return empty
  if (answeredTopics?.has(topic) && topic !== 'confirm' && topic !== 'unknown') {
    return '';
  }

  return singleTopicAnswer(topic, persona, config);
}

/**
 * Generate a compound answer covering all topics in the system message.
 * Skips topics we've already answered. Returns the answer + which topics were covered.
 */
export function generateCompoundAnswer(
  systemMessage: string,
  persona: ParentPersona,
  config: ScenarioConfig,
  answeredTopics: Set<string>,
): { answer: string; topics: OnboardingTopic[] } {
  const allTopics = classifyAllTopics(systemMessage);

  // Filter out already-answered topics (except confirm/confirmed)
  const newTopics = allTopics.filter(t =>
    t === 'confirm' || t === 'confirmed' || !answeredTopics.has(t)
  );

  if (newTopics.length === 0 || (newTopics.length === 1 && newTopics[0] === 'unknown')) {
    // Nothing new to answer — try to give the next piece of info
    // that hasn't been provided yet
    const infoOrder: OnboardingTopic[] = [
      'children_count', 'arrangement', 'locked_days', 'weekends',
      'split', 'exchange', 'distance', 'phone', 'frustrations',
    ];
    for (const t of infoOrder) {
      if (!answeredTopics.has(t)) {
        const answer = singleTopicAnswer(t, persona, config);
        if (answer) return { answer, topics: [t] };
      }
    }
    // Everything answered, just confirm
    return { answer: 'Yes, that all sounds right.', topics: ['confirm'] };
  }

  // Build compound answer
  const parts: string[] = [];
  const covered: OnboardingTopic[] = [];

  for (const t of newTopics) {
    const part = singleTopicAnswer(t, persona, config);
    if (part) {
      parts.push(part);
      covered.push(t);
    }
  }

  return {
    answer: parts.join('. ') || 'Yes',
    topics: covered,
  };
}

/**
 * Check if the onboarding conversation is complete.
 */
export function isOnboardingComplete(systemMessage: string): boolean {
  return classifySystemMessage(systemMessage) === 'confirmed';
}

/**
 * Generate Parent B's response to a partner invite.
 */
export function generateParentBJoinResponse(_persona: ParentPersona): string {
  return 'START';
}

/**
 * Generate Parent B's answer to a post-join system message.
 */
export function generateParentBReactiveAnswer(
  systemMessage: string,
  persona: ParentPersona,
  config: ScenarioConfig,
): string {
  const topic = classifySystemMessage(systemMessage);
  if (topic === 'confirmed') return '';
  if (topic === 'greeting') return 'Hi, I just joined. What do I need to do?';
  return singleTopicAnswer(topic, persona, config);
}

// ── Synthetic Onboarding System (offline mode) ──

/**
 * When the real API is unavailable (LLM errors), this generates realistic
 * system responses to drive the onboarding conversation locally.
 */

const ONBOARDING_FLOW: Array<{
  step: string;
  askTopics: OnboardingTopic[];
  systemMessage: (config: ScenarioConfig, answeredTopics: Set<string>) => string;
}> = [
  {
    step: 'welcome',
    askTopics: ['children_count'],
    systemMessage: () =>
      "Welcome to ADCP! I help co-parents create fair, stable custody schedules. Let's get started — how many children do you have, and what are their ages?",
  },
  {
    step: 'arrangement',
    askTopics: ['arrangement'],
    systemMessage: (config) => {
      const kids = config.children.map(c => `${c.name} (age ${c.age})`).join(', ');
      return `Great, thanks! I see you have ${config.children.length > 1 ? 'children' : 'a child'}: ${kids}. What custody arrangement are you currently using or hoping for? For example: alternating weeks, 2-2-3, 3-4-4-3, 5-2, etc.`;
    },
  },
  {
    step: 'split_distance',
    askTopics: ['split', 'distance'],
    systemMessage: (config) =>
      `Got it — ${TEMPLATE_NAMES[config.template] || config.template}. What time split are you aiming for? And how far apart do you and your co-parent live?`,
  },
  {
    step: 'locked_weekends',
    askTopics: ['locked_days', 'weekends'],
    systemMessage: () =>
      'Are there any specific nights that must always be with one parent? (e.g., school nights, work schedule constraints) And how do you handle weekends?',
  },
  {
    step: 'exchange_frustrations',
    askTopics: ['exchange', 'frustrations'],
    systemMessage: () =>
      "How do exchanges typically work? (e.g., school drop-off, direct handoff) And what's the biggest frustration with your current schedule?",
  },
  {
    step: 'partner_phone',
    askTopics: ['phone'],
    systemMessage: () =>
      "Almost done! What's your co-parent's phone number so I can invite them to join?",
  },
  {
    step: 'confirm',
    askTopics: ['confirm'],
    systemMessage: (config) => {
      const kids = config.children.map(c => `${c.name} (${c.age})`).join(', ');
      const split = `${config.targetSplit}/${100 - config.targetSplit}`;
      return `Here's what I have:\n• Children: ${kids}\n• Arrangement: ${TEMPLATE_NAMES[config.template] || config.template}\n• Target split: ${split}\n• Distance: ${config.distanceMiles} miles\n\nDoes this look right? I'll generate your schedule and invite your co-parent.`;
    },
  },
  {
    step: 'complete',
    askTopics: ['confirmed'],
    systemMessage: () =>
      "Your family schedule is now created! I've sent an invite to your co-parent. You can view your upcoming exchanges by typing 'schedule'. Type 'help' for available commands.",
  },
];

/**
 * Generate a synthetic system response for the given answered topics.
 * Returns the next question in the onboarding flow.
 */
export function generateSyntheticSystemResponse(
  config: ScenarioConfig,
  answeredTopics: Set<string>,
): string {
  for (const step of ONBOARDING_FLOW) {
    // Find the first step that has at least one unanswered topic
    const hasUnanswered = step.askTopics.some(t => !answeredTopics.has(t));
    if (hasUnanswered) {
      return step.systemMessage(config, answeredTopics);
    }
  }
  // Everything answered — return completion message
  return ONBOARDING_FLOW[ONBOARDING_FLOW.length - 1].systemMessage(config, answeredTopics);
}

/**
 * Check if a webhook response is an error.
 */
export function isApiError(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes('sorry') || lower.includes('went wrong') || lower.includes('something went wrong');
}

// ── Batch Simulation Metrics ──

export interface SimulationMetrics {
  totalProposals: number;
  acceptanceRate: number;
  rejectionRate: number;
  counterRate: number;
  ignoreRate: number;
  avgFairnessDeviation: number;
  maxFairnessDeviation: number;
  conflictEscalations: number;
  gamingAttempts: number;
  scheduleVolatility: number; // transitions changed per week
}

// ── Archetype-Aware Evaluation ──

/**
 * Get the interaction archetype for a pair of persona IDs.
 */
export function getArchetype(personaAId: string, personaBId: string): InteractionArchetype | null {
  return INTERACTION_ARCHETYPES.find(
    a => a.parent_a === personaAId && a.parent_b === personaBId
  ) || INTERACTION_ARCHETYPES.find(
    a => a.parent_a === personaBId && a.parent_b === personaAId
  ) || null;
}

/**
 * Get the expected response pattern for a scenario.
 */
export function getResponsePattern(scenarioId: string): DisruptionResponsePattern | null {
  return DISRUPTION_RESPONSE_PATTERNS.find(p => p.scenario === scenarioId) || null;
}

/**
 * Evaluate whether an archetype is likely to conflict on a given scenario.
 */
export function isHighConflictMatch(archetypeId: string, scenarioId: string): boolean {
  const pattern = getResponsePattern(scenarioId);
  if (!pattern) return false;
  return pattern.likely_conflict_archetypes.includes(archetypeId);
}

/**
 * Evaluate a proposal using archetype conflict probability as a modifier.
 * Wraps evaluateProposal with archetype-level adjustments.
 */
export function evaluateProposalWithArchetype(
  persona: ParentPersona,
  archetype: InteractionArchetype | null,
  fairnessDeviation: number,
  transitionIncrease: boolean,
  isDisruptionRelated: boolean,
  currentDay: number,
): DecisionResult {
  const result = evaluateProposal(persona, fairnessDeviation, transitionIncrease, isDisruptionRelated, currentDay);

  if (!archetype) return result;

  // Archetype conflict probability can override accept → counter/reject
  if (result.decision === 'accept' && Math.random() < archetype.conflict_probability) {
    return {
      ...result,
      decision: 'counter',
      reasoning: `${result.reasoning} [archetype ${archetype.id} escalated: conflict_prob=${archetype.conflict_probability}]`,
    };
  }

  return result;
}

// ── Simulation Outputs ──

export type SimulationOutputType =
  | 'event_timeline'
  | 'proposal_bundles_generated'
  | 'parent_responses'
  | 'fairness_metrics'
  | 'transition_counts'
  | 'solver_decision_trace'
  | 'edge_case_flags'
  | 'resolution_summary';

export const EXPECTED_SIMULATION_OUTPUTS: SimulationOutputType[] = [
  'event_timeline',
  'proposal_bundles_generated',
  'parent_responses',
  'fairness_metrics',
  'transition_counts',
  'solver_decision_trace',
  'edge_case_flags',
  'resolution_summary',
];

export function computeMetrics(decisions: DecisionResult[]): SimulationMetrics {
  const total = decisions.length;
  if (total === 0) {
    return {
      totalProposals: 0, acceptanceRate: 0, rejectionRate: 0,
      counterRate: 0, ignoreRate: 0, avgFairnessDeviation: 0,
      maxFairnessDeviation: 0, conflictEscalations: 0,
      gamingAttempts: 0, scheduleVolatility: 0,
    };
  }

  const counts = { accept: 0, reject: 0, counter: 0, ignore: 0, delay: 0 };
  let gamingAttempts = 0;

  for (const d of decisions) {
    counts[d.decision]++;
    if (d.injected_events?.some(e => e.type === 'extra_time_request')) {
      gamingAttempts++;
    }
  }

  // Count consecutive rejections as escalations
  let escalations = 0;
  let rejectStreak = 0;
  for (const d of decisions) {
    if (d.decision === 'reject') {
      rejectStreak++;
      if (rejectStreak >= 2) escalations++;
    } else {
      rejectStreak = 0;
    }
  }

  return {
    totalProposals: total,
    acceptanceRate: counts.accept / total,
    rejectionRate: counts.reject / total,
    counterRate: counts.counter / total,
    ignoreRate: counts.ignore / total,
    avgFairnessDeviation: 0, // Needs schedule context
    maxFairnessDeviation: 0,
    conflictEscalations: escalations,
    gamingAttempts,
    scheduleVolatility: 0,
  };
}
