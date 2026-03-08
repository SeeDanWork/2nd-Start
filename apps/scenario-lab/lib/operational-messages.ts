// ── Operational Message Protocol ──────────────────────────────
// Generates structured, non-chatty messages during stable periods.
// Three modes: quiet monitoring (default), operational notifications,
// strategic optimization.
//
// Core principle: silent unless useful.

import { ScenarioConfig, ScheduleDay } from './types';

// ── Message Types ──

export type OperationalMessageType =
  | 'DAILY_SUMMARY'
  | 'RESPONSIBILITY_REMINDER'
  | 'LOGISTICS_CLARIFICATION'
  | 'WEEKLY_OVERVIEW'
  | 'FAIRNESS_ALERT'
  | 'LONG_STRETCH_ALERT'
  | 'MONTHLY_SUMMARY'
  | 'OPTIMIZATION_PROMPT'
  | 'HOLIDAY_PLANNING'
  | 'FRICTION_DETECTION'
  | 'SILENT';

export interface OperationalMessage {
  type: OperationalMessageType;
  recipient: 'parent_a' | 'parent_b' | 'both';
  text: string;
  metrics?: ScheduleMetrics;
}

export interface ScheduleMetrics {
  fairnessBalance: { parentA: number; parentB: number };
  transitionsThisWeek: number;
  avgBlockLength: number;
  stabilityScore: 'strong' | 'moderate' | 'weak';
  schoolNightExchanges: number;
  longestStreak: { parent: 'parent_a' | 'parent_b'; nights: number };
}

// ── Metrics Computation ──

export function computeScheduleMetrics(
  schedule: ScheduleDay[],
  windowDays = 56, // 8 weeks
): ScheduleMetrics {
  const window = schedule.slice(0, windowDays);
  if (window.length === 0) {
    return {
      fairnessBalance: { parentA: 0, parentB: 0 },
      transitionsThisWeek: 0,
      avgBlockLength: 0,
      stabilityScore: 'strong',
      schoolNightExchanges: 0,
      longestStreak: { parent: 'parent_a', nights: 0 },
    };
  }

  // Fairness
  const aNights = window.filter(d => d.assignedTo === 'parent_a').length;
  const bNights = window.length - aNights;

  // Transitions
  const transitions = window.filter(d => d.isTransition).length;
  const weeksInWindow = Math.max(1, window.length / 7);
  const transitionsPerWeek = transitions / weeksInWindow;

  // Block lengths
  const blocks: number[] = [];
  let currentBlock = 1;
  for (let i = 1; i < window.length; i++) {
    if (window[i].assignedTo === window[i - 1].assignedTo) {
      currentBlock++;
    } else {
      blocks.push(currentBlock);
      currentBlock = 1;
    }
  }
  blocks.push(currentBlock);
  const avgBlock = blocks.reduce((a, b) => a + b, 0) / blocks.length;

  // Longest streak
  let maxStreak = 0;
  let maxParent: 'parent_a' | 'parent_b' = 'parent_a';
  let streak = 1;
  for (let i = 1; i < window.length; i++) {
    if (window[i].assignedTo === window[i - 1].assignedTo) {
      streak++;
      if (streak > maxStreak) {
        maxStreak = streak;
        maxParent = window[i].assignedTo;
      }
    } else {
      streak = 1;
    }
  }

  // School-night exchanges (Sun-Thu transitions = school nights)
  let schoolNightExchanges = 0;
  for (const day of window) {
    if (!day.isTransition) continue;
    const date = new Date(day.date);
    const dow = date.getDay();
    if (dow >= 0 && dow <= 4) schoolNightExchanges++; // Sun-Thu
  }

  // Stability
  const fairnessDrift = Math.abs(aNights - bNights);
  let stabilityScore: 'strong' | 'moderate' | 'weak';
  if (fairnessDrift <= 2 && transitionsPerWeek <= 2) stabilityScore = 'strong';
  else if (fairnessDrift <= 5 && transitionsPerWeek <= 3) stabilityScore = 'moderate';
  else stabilityScore = 'weak';

  return {
    fairnessBalance: { parentA: aNights, parentB: bNights },
    transitionsThisWeek: Math.round(transitionsPerWeek * 10) / 10,
    avgBlockLength: Math.round(avgBlock * 10) / 10,
    stabilityScore,
    schoolNightExchanges: Math.round(schoolNightExchanges / weeksInWindow * 10) / 10,
    longestStreak: { parent: maxParent, nights: maxStreak },
  };
}

// ── Message Generators ──

function getParentLabel(parent: 'parent_a' | 'parent_b', config: ScenarioConfig): string {
  return parent === 'parent_a' ? config.parentA.label : config.parentB.label;
}

function getChildNames(config: ScenarioConfig): string {
  return config.children.map(c => c.name).join(' & ');
}

export function generateDailySummary(
  config: ScenarioConfig,
  schedule: ScheduleDay[],
  simDay: number,
  recipient: 'parent_a' | 'parent_b',
): OperationalMessage {
  const today = schedule[simDay];
  if (!today) return { type: 'SILENT', recipient, text: '' };

  const metrics = computeScheduleMetrics(schedule.slice(Math.max(0, simDay - 56), simDay + 1));
  const childNames = getChildNames(config);
  const assignedLabel = getParentLabel(today.assignedTo, config);

  // Find next transition
  let nextTransition: ScheduleDay | null = null;
  for (let i = simDay + 1; i < schedule.length; i++) {
    if (schedule[i].isTransition) {
      nextTransition = schedule[i];
      break;
    }
  }

  const dateStr = new Date(today.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const lines = [
    `${dateStr} | ${childNames} with ${assignedLabel}`,
  ];

  if (today.isTransition) {
    lines.push(`Transition day. Custody moves to ${assignedLabel}.`);
  }

  if (nextTransition) {
    const transDate = new Date(nextTransition.date);
    const dayName = transDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    const transLabel = getParentLabel(nextTransition.assignedTo, config);
    lines.push(`Next exchange: ${dayName} to ${transLabel}`);
  }

  const drift = metrics.fairnessBalance.parentA - metrics.fairnessBalance.parentB;
  const driftStr = drift === 0 ? 'balanced'
    : drift > 0 ? `+${drift} ${config.parentA.label}`
    : `+${Math.abs(drift)} ${config.parentB.label}`;
  lines.push(`Fairness (8wk): ${driftStr}`);
  lines.push(`Stability: ${metrics.stabilityScore}`);

  return {
    type: 'DAILY_SUMMARY',
    recipient,
    text: lines.join('\n'),
    metrics,
  };
}

export function generateWeeklyOverview(
  config: ScenarioConfig,
  schedule: ScheduleDay[],
  weekStartDay: number,
): OperationalMessage {
  const weekDays = schedule.slice(weekStartDay, weekStartDay + 7);
  if (weekDays.length === 0) return { type: 'SILENT', recipient: 'both', text: '' };

  const metrics = computeScheduleMetrics(
    schedule.slice(Math.max(0, weekStartDay - 56), weekStartDay + 7),
  );

  // Build week assignment summary
  const blocks: Array<{ parent: string; start: string; end: string }> = [];
  let blockStart = 0;
  for (let i = 1; i <= weekDays.length; i++) {
    if (i === weekDays.length || weekDays[i].assignedTo !== weekDays[blockStart].assignedTo) {
      const startDay = new Date(weekDays[blockStart].date).toLocaleDateString('en-US', { weekday: 'short' });
      const endDay = new Date(weekDays[i - 1].date).toLocaleDateString('en-US', { weekday: 'short' });
      const label = getParentLabel(weekDays[blockStart].assignedTo, config);
      blocks.push({
        parent: label,
        start: startDay,
        end: startDay === endDay ? startDay : `${startDay}–${endDay}`,
      });
      blockStart = i;
    }
  }

  const weekTransitions = weekDays.filter(d => d.isTransition).length;
  const nextExchange = weekDays.find(d => d.isTransition);
  const nextExchangeStr = nextExchange
    ? new Date(nextExchange.date).toLocaleDateString('en-US', { weekday: 'long' })
    : 'none';

  const lines = [
    'Weekly schedule review.',
    '',
    ...blocks.map(b => `${b.end}: ${b.parent}`),
    '',
    `Transitions: ${weekTransitions}`,
    `Next exchange: ${nextExchangeStr}`,
    '',
    `Fairness window (8 weeks):`,
    `${config.parentA.label}: ${metrics.fairnessBalance.parentA} nights`,
    `${config.parentB.label}: ${metrics.fairnessBalance.parentB} nights`,
    `Stability: ${metrics.stabilityScore}`,
  ];

  // Deterministic alerts based on thresholds
  const drift = Math.abs(metrics.fairnessBalance.parentA - metrics.fairnessBalance.parentB);
  if (drift >= 3) {
    const ahead = metrics.fairnessBalance.parentA > metrics.fairnessBalance.parentB
      ? config.parentA.label : config.parentB.label;
    lines.push('');
    lines.push(`Fairness drift: ${ahead} +${drift} nights.`);
    lines.push('Constraint: system will rebalance in upcoming cycles.');
  }

  if (metrics.longestStreak.nights >= 6) {
    const streakLabel = getParentLabel(metrics.longestStreak.parent, config);
    lines.push('');
    lines.push(`Long stretch: ${streakLabel}, ${metrics.longestStreak.nights} consecutive nights.`);
    lines.push('Within policy bounds. Monitoring.');
  }

  if (weekTransitions >= 3) {
    lines.push('');
    lines.push(`High transition count: ${weekTransitions} exchanges this week.`);
    lines.push('Constraint: consider lower-transition alternative.');
  }

  if (drift < 3 && metrics.longestStreak.nights < 6 && weekTransitions < 3) {
    lines.push('');
    lines.push('All constraints satisfied. No action required.');
  }

  return {
    type: 'WEEKLY_OVERVIEW',
    recipient: 'both',
    text: lines.join('\n'),
    metrics,
  };
}

export function generateMonthlySummary(
  config: ScenarioConfig,
  schedule: ScheduleDay[],
  monthEndDay: number,
): OperationalMessage {
  const monthDays = schedule.slice(Math.max(0, monthEndDay - 28), monthEndDay);
  if (monthDays.length === 0) return { type: 'SILENT', recipient: 'both', text: '' };

  const metrics = computeScheduleMetrics(monthDays, monthDays.length);

  const totalTransitions = monthDays.filter(d => d.isTransition).length;
  const drift = metrics.fairnessBalance.parentA - metrics.fairnessBalance.parentB;
  const driftStr = drift === 0 ? 'balanced'
    : drift > 0 ? `+${drift} nights ${config.parentA.label}`
    : `+${Math.abs(drift)} nights ${config.parentB.label}`;

  const lines = [
    'Monthly schedule report.',
    '',
    `Transitions: ${totalTransitions}`,
    `Avg block length: ${metrics.avgBlockLength} nights`,
    `Fairness: ${driftStr}`,
    `Stability: ${metrics.stabilityScore}`,
    `School-night exchanges: ${metrics.schoolNightExchanges}/week`,
  ];

  if (metrics.stabilityScore === 'strong') {
    lines.push('');
    lines.push('All constraints satisfied. Schedule operating within bounds.');
  } else if (metrics.stabilityScore === 'weak') {
    lines.push('');
    lines.push('Stability below threshold. Review recommended.');
  }

  return {
    type: 'MONTHLY_SUMMARY',
    recipient: 'both',
    text: lines.join('\n'),
    metrics,
  };
}

// ── Cadence Controller ──

export type InteractionMode = 'quiet' | 'operational' | 'strategic';

/**
 * Determine what message (if any) to generate for a given simulation day.
 * Returns SILENT for most days — only surfaces messages when useful.
 */
export function getOperationalMessage(
  config: ScenarioConfig,
  schedule: ScheduleDay[],
  simDay: number,
  recipient: 'parent_a' | 'parent_b',
): OperationalMessage {
  if (schedule.length === 0) return { type: 'SILENT', recipient, text: '' };

  const today = schedule[simDay];
  if (!today) return { type: 'SILENT', recipient, text: '' };

  const date = new Date(today.date);
  const dow = date.getDay(); // 0=Sun

  // Monthly summary: day 28, 56, etc.
  if (simDay > 0 && simDay % 28 === 0) {
    return generateMonthlySummary(config, schedule, simDay);
  }

  // Weekly overview: Sunday evening (day 0 of each week)
  if (dow === 0 && simDay % 7 === 0 && simDay > 0) {
    return generateWeeklyOverview(config, schedule, simDay);
  }

  // Daily summary only on transition days or first day
  if (today.isTransition || simDay === 0) {
    return generateDailySummary(config, schedule, simDay, recipient);
  }

  // Default: silent
  return { type: 'SILENT', recipient, text: '' };
}

/**
 * Generate a fairness alert if drift exceeds threshold.
 */
export function checkFairnessAlert(
  config: ScenarioConfig,
  schedule: ScheduleDay[],
  simDay: number,
): OperationalMessage | null {
  const metrics = computeScheduleMetrics(
    schedule.slice(Math.max(0, simDay - 56), simDay + 1),
  );
  const drift = Math.abs(metrics.fairnessBalance.parentA - metrics.fairnessBalance.parentB);

  if (drift >= 3) {
    const ahead = metrics.fairnessBalance.parentA > metrics.fairnessBalance.parentB
      ? config.parentA.label : config.parentB.label;
    return {
      type: 'FAIRNESS_ALERT',
      recipient: 'both',
      text: [
        'Fairness drift detected.',
        `${ahead} currently +${drift} nights over 8 weeks.`,
        '',
        'Future schedules will likely rebalance.',
      ].join('\n'),
      metrics,
    };
  }

  return null;
}

/**
 * Generate a friction detection alert if upcoming week has too many transitions.
 */
export function checkFrictionAhead(
  config: ScenarioConfig,
  schedule: ScheduleDay[],
  simDay: number,
): OperationalMessage | null {
  const upcoming = schedule.slice(simDay, simDay + 7);
  const transitions = upcoming.filter(d => d.isTransition).length;

  if (transitions >= 3) {
    return {
      type: 'FRICTION_DETECTION',
      recipient: 'both',
      text: [
        'Heads up:',
        '',
        `${transitions} exchanges occur next week.`,
        '',
        'Would you like the system to propose a lower-transition option?',
      ].join('\n'),
    };
  }

  return null;
}
