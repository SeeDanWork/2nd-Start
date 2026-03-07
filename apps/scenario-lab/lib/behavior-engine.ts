// ── Persona Behavior Engine ──────────────────────────────────
// Determines how personas automatically respond to proposals,
// disruptions, and schedule changes.

import { ParentPersona } from './personas';
import { ScenarioEvent } from './scenarios';

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
