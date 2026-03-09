// ── Deterministic Explanation Engine ─────────────────────────
// Generates structured explanations from solver/schedule metrics.
// No LLM reasoning. Template + metrics → explanation.
//
// Architecture: CP-SAT solver → explanation object → formatted output
// Tone: operations-planner. Short, mechanical sentences.

import { ScenarioConfig, ScheduleDay } from './types';
import { computeScheduleMetrics, ScheduleMetrics } from './operational-messages';

// ── Explanation Schema ──

export interface ExplanationObject {
  /** What changed */
  change: {
    summary: string;
    detail: string;
  };
  /** Why it changed — deterministic factors */
  factors: Factor[];
  /** Before/after comparison */
  comparison: {
    before: MetricSnapshot;
    after: MetricSnapshot;
  };
  /** Score components (Level 3 debug) */
  scores: ScoreComponents;
}

export interface Factor {
  label: string;
  status: 'improved' | 'unchanged' | 'degraded';
  value?: string;
}

export interface MetricSnapshot {
  parentANights: number;
  parentBNights: number;
  transitionsPerWeek: number;
  avgBlockLength: number;
  stabilityScore: 'strong' | 'moderate' | 'weak';
  schoolNightExchanges: number;
}

export interface ScoreComponents {
  fairness_penalty: number;
  transition_penalty: number;
  routine_penalty: number;
  fragmentation_penalty: number;
  total_score: number;
}

// ── Metric Snapshot from Schedule ──

export function snapshotMetrics(
  schedule: ScheduleDay[],
  fromDay: number,
  windowDays = 56,
): MetricSnapshot {
  const window = schedule.slice(fromDay, fromDay + windowDays);
  const metrics = computeScheduleMetrics(window, window.length);
  return {
    parentANights: metrics.fairnessBalance.parentA,
    parentBNights: metrics.fairnessBalance.parentB,
    transitionsPerWeek: metrics.transitionsThisWeek,
    avgBlockLength: metrics.avgBlockLength,
    stabilityScore: metrics.stabilityScore,
    schoolNightExchanges: metrics.schoolNightExchanges,
  };
}

// ── Score Computation ──

function computeScores(before: MetricSnapshot, after: MetricSnapshot): ScoreComponents {
  const fairnessBefore = Math.abs(before.parentANights - before.parentBNights);
  const fairnessAfter = Math.abs(after.parentANights - after.parentBNights);
  const fairness_penalty = fairnessAfter - fairnessBefore; // negative = improved

  const transition_penalty = after.transitionsPerWeek - before.transitionsPerWeek;
  const routine_penalty = after.schoolNightExchanges - before.schoolNightExchanges;

  const fragBefore = before.avgBlockLength;
  const fragAfter = after.avgBlockLength;
  const fragmentation_penalty = fragBefore - fragAfter; // lower blocks = more fragmented

  const total_score = fairness_penalty + transition_penalty + routine_penalty + fragmentation_penalty;

  return { fairness_penalty, transition_penalty, routine_penalty, fragmentation_penalty, total_score };
}

// ── Factor Analysis ──

function analyzeFactors(
  before: MetricSnapshot,
  after: MetricSnapshot,
  config: ScenarioConfig,
): Factor[] {
  const factors: Factor[] = [];

  // Fairness
  const driftBefore = Math.abs(before.parentANights - before.parentBNights);
  const driftAfter = Math.abs(after.parentANights - after.parentBNights);
  const fairnessStatus = driftAfter < driftBefore ? 'improved'
    : driftAfter > driftBefore ? 'degraded' : 'unchanged';
  const splitStr = `${after.parentANights}/${after.parentBNights}`;
  factors.push({
    label: `Fairness balance: ${splitStr}`,
    status: fairnessStatus,
    value: `${config.targetSplit}/${100 - config.targetSplit} target`,
  });

  // Transitions
  const transStatus = after.transitionsPerWeek < before.transitionsPerWeek ? 'improved'
    : after.transitionsPerWeek > before.transitionsPerWeek ? 'degraded' : 'unchanged';
  factors.push({
    label: `Transitions/week: ${after.transitionsPerWeek}`,
    status: transStatus,
  });

  // Routine stability
  const stabStatus = stabilityRank(after.stabilityScore) >= stabilityRank(before.stabilityScore)
    ? (stabilityRank(after.stabilityScore) > stabilityRank(before.stabilityScore) ? 'improved' : 'unchanged')
    : 'degraded';
  factors.push({
    label: `Routine stability: ${after.stabilityScore}`,
    status: stabStatus,
  });

  // School nights
  const schoolStatus = after.schoolNightExchanges < before.schoolNightExchanges ? 'improved'
    : after.schoolNightExchanges > before.schoolNightExchanges ? 'degraded' : 'unchanged';
  factors.push({
    label: `School-night exchanges: ${after.schoolNightExchanges}/week`,
    status: schoolStatus,
  });

  // Block length
  const blockStatus = after.avgBlockLength >= before.avgBlockLength ? 'unchanged' : 'degraded';
  factors.push({
    label: `Avg block length: ${after.avgBlockLength} nights`,
    status: blockStatus,
  });

  return factors;
}

function stabilityRank(s: 'strong' | 'moderate' | 'weak'): number {
  return s === 'strong' ? 3 : s === 'moderate' ? 2 : 1;
}

// ── Build Full Explanation ──

export function buildExplanation(
  config: ScenarioConfig,
  schedule: ScheduleDay[],
  currentDay: number,
  changeSummary: string,
  changeDetail: string,
): ExplanationObject {
  const before = snapshotMetrics(schedule, Math.max(0, currentDay - 56), 56);
  const after = snapshotMetrics(schedule, currentDay, 56);
  const factors = analyzeFactors(before, after, config);
  const scores = computeScores(before, after);

  return {
    change: { summary: changeSummary, detail: changeDetail },
    factors,
    comparison: { before, after },
    scores,
  };
}

// ── Format Explanation (Three Levels) ──

const STATUS_ICON: Record<string, string> = {
  improved: '+',
  unchanged: '=',
  degraded: '-',
};

/** Level 1: One-line summary */
export function formatLevel1(explanation: ExplanationObject): string {
  const improved = explanation.factors.filter(f => f.status === 'improved');
  const degraded = explanation.factors.filter(f => f.status === 'degraded');

  if (degraded.length === 0 && improved.length > 0) {
    return `${explanation.change.summary} Improves ${improved.map(f => f.label.split(':')[0].toLowerCase()).join(', ')}.`;
  }
  if (degraded.length > 0 && improved.length === 0) {
    return `${explanation.change.summary} Trade-off: ${degraded.map(f => f.label.split(':')[0].toLowerCase()).join(', ')} impacted.`;
  }
  if (improved.length > 0 && degraded.length > 0) {
    return `${explanation.change.summary} Improves ${improved[0].label.split(':')[0].toLowerCase()}, ${degraded[0].label.split(':')[0].toLowerCase()} impacted.`;
  }
  return `${explanation.change.summary} No metric changes detected.`;
}

/** Level 2: Factor breakdown */
export function formatLevel2(explanation: ExplanationObject): string {
  const lines = ['Factors considered:'];
  for (const f of explanation.factors) {
    lines.push(`[${STATUS_ICON[f.status]}] ${f.label}`);
  }
  return lines.join('\n');
}

/** Level 3: Debug score components */
export function formatLevel3(explanation: ExplanationObject): string {
  const s = explanation.scores;
  return [
    'Score components:',
    `fairness_penalty = ${s.fairness_penalty}`,
    `transition_penalty = ${s.transition_penalty}`,
    `routine_penalty = ${s.routine_penalty}`,
    `fragmentation_penalty = ${s.fragmentation_penalty}`,
    `total_score = ${s.total_score}`,
  ].join('\n');
}

/** Full calculation trace (Level 1 + 2) for messages */
export function formatCalculationTrace(
  explanation: ExplanationObject,
  config: ScenarioConfig,
): string {
  const b = explanation.comparison.before;
  const a = explanation.comparison.after;
  const aLabel = config.parentA.label;
  const bLabel = config.parentB.label;

  const lines = [
    explanation.change.detail,
    '',
    'Before:',
    `${aLabel}: ${b.parentANights} nights | ${bLabel}: ${b.parentBNights} nights`,
    `Transitions: ${b.transitionsPerWeek}/week | Stability: ${b.stabilityScore}`,
    '',
    'After:',
    `${aLabel}: ${a.parentANights} nights | ${bLabel}: ${a.parentBNights} nights`,
    `Transitions: ${a.transitionsPerWeek}/week | Stability: ${a.stabilityScore}`,
    '',
    'Evaluation:',
  ];

  for (const f of explanation.factors) {
    lines.push(`[${STATUS_ICON[f.status]}] ${f.label}`);
  }

  return lines.join('\n');
}

// ── Disruption-Specific Explanation ──

export function buildDisruptionExplanation(
  config: ScenarioConfig,
  schedule: ScheduleDay[],
  currentDay: number,
  disruptionName: string,
  disruptionDescription: string,
  decisionA: { decision: string; confidence: number } | null,
  decisionB: { decision: string; confidence: number } | null,
): string {
  const snapshot = snapshotMetrics(schedule, currentDay, 56);
  const aLabel = config.parentA.label;
  const bLabel = config.parentB.label;

  const lines = [
    `Schedule disruption: ${disruptionName}`,
    disruptionDescription,
    '',
    'Current schedule metrics (8-week window):',
    `${aLabel}: ${snapshot.parentANights} nights | ${bLabel}: ${snapshot.parentBNights} nights`,
    `Transitions: ${snapshot.transitionsPerWeek}/week`,
    `Stability: ${snapshot.stabilityScore}`,
    `School-night exchanges: ${snapshot.schoolNightExchanges}/week`,
    `Avg block length: ${snapshot.avgBlockLength} nights`,
  ];

  if (decisionA && decisionB) {
    lines.push('');
    lines.push('Parent responses:');
    lines.push(`${aLabel}: ${decisionA.decision} (${Math.round(decisionA.confidence * 100)}%)`);
    lines.push(`${bLabel}: ${decisionB.decision} (${Math.round(decisionB.confidence * 100)}%)`);

    lines.push('');
    if (decisionA.decision === 'accept' && decisionB.decision === 'accept') {
      lines.push('Result: Both parents agree. Adjustment can proceed.');
      lines.push('Constraint: fairness window will rebalance over 2 weeks.');
    } else if (decisionA.decision === 'reject' || decisionB.decision === 'reject') {
      lines.push('Result: Disagreement. System falls back to base schedule.');
      lines.push('Constraint: no schedule modification applied.');
    } else if (decisionA.decision === 'counter' || decisionB.decision === 'counter') {
      lines.push('Result: Counter-proposal raised. Negotiation required.');
      lines.push('Constraint: system will propose alternative within policy bounds.');
    }
  }

  return lines.join('\n');
}

// ── Operational Day Explanation ──

export function buildDaySummaryExplanation(
  config: ScenarioConfig,
  schedule: ScheduleDay[],
  simDay: number,
  recipient?: 'parent_a' | 'parent_b',
): string {
  const today = schedule[simDay];
  if (!today) return '';

  const childNames = config.children.map(c => c.name).join(' & ');
  const dateStr = new Date(today.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  // Personalize based on recipient
  const isWithRecipient = recipient ? today.assignedTo === recipient : false;
  const assignedLabel = recipient
    ? (isWithRecipient ? 'you' : (today.assignedTo === 'parent_a' ? config.parentA.label : config.parentB.label))
    : (today.assignedTo === 'parent_a' ? config.parentA.label : config.parentB.label);

  // Find next transition
  let nextTransitionDate = '';
  let nextTransitionLabel = '';
  for (let i = simDay + 1; i < schedule.length; i++) {
    if (schedule[i].isTransition) {
      const d = new Date(schedule[i].date);
      nextTransitionDate = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      if (recipient) {
        nextTransitionLabel = schedule[i].assignedTo === recipient ? 'you' : (schedule[i].assignedTo === 'parent_a' ? config.parentA.label : config.parentB.label);
      } else {
        nextTransitionLabel = schedule[i].assignedTo === 'parent_a' ? config.parentA.label : config.parentB.label;
      }
      break;
    }
  }

  const lines = [
    `${dateStr} | ${childNames} with ${assignedLabel}.`,
  ];

  if (today.isTransition) {
    const movesTo = recipient
      ? (isWithRecipient ? 'you' : (today.assignedTo === 'parent_a' ? config.parentA.label : config.parentB.label))
      : (today.assignedTo === 'parent_a' ? config.parentA.label : config.parentB.label);
    lines.push(`Transition day. Custody moves to ${movesTo}.`);
  }

  if (nextTransitionDate) {
    lines.push(`Next exchange: ${nextTransitionDate} to ${nextTransitionLabel}.`);
  }

  lines.push('No action required.');

  return lines.join('\n');
}
