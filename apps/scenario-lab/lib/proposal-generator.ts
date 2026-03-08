// ── Deterministic Proposal Generator ─────────────────────────
// Generates ProposalBundle objects from schedule state.
// All proposals are solver-derived. No randomness.
// LLM only explains proposals — never generates them.

import { ScenarioConfig, ScheduleDay } from './types';
import {
  ActiveDisruption,
  ProposalBundle,
  ProposalOption,
  CoverageType,
} from './disruption-engine';
import { computeScheduleMetrics } from './operational-messages';

// ── Generate Proposal Bundle ──

export function generateProposalBundle(
  config: ScenarioConfig,
  schedule: ScheduleDay[],
  disruption: ActiveDisruption,
  currentDay: number,
): ProposalBundle {
  const options: ProposalOption[] = [];
  const reporter = disruption.reportingParent;
  const other = disruption.otherParent;
  const reporterLabel = reporter === 'parent_a' ? config.parentA.label : config.parentB.label;
  const otherLabel = other === 'parent_a' ? config.parentA.label : config.parentB.label;

  const affected = disruption.affectedDays;
  if (affected.length === 0) {
    return { disruptionId: disruption.id, options: [], generatedAt: new Date().toISOString() };
  }

  // Compute current fairness window
  const windowStart = Math.max(0, currentDay - 56);
  const windowSlice = schedule.slice(windowStart, currentDay + 56);
  const currentMetrics = computeScheduleMetrics(windowSlice, windowSlice.length);

  // ── Option A: Full coverage transfer ──
  const fullCoverageDays = affected.map(date => ({
    date,
    parent: other,
    type: 'full_custody_transfer' as CoverageType,
  }));

  // Find compensation days: same number of days transferred back in the following week
  const compensationDays = findCompensationDays(
    schedule, currentDay, affected.length, reporter, other,
  );

  options.push({
    id: `${disruption.id}-A`,
    label: 'Full coverage transfer',
    description: `${otherLabel} covers ${formatDateRange(affected)}. ${reporterLabel} receives compensation ${compensationDays.length > 0 ? formatDateRange(compensationDays.map(d => d.date)) : 'next available window'}.`,
    coverageDays: fullCoverageDays,
    compensationDays,
    fairnessImpact: {
      parentADelta: reporter === 'parent_a' ? -affected.length : affected.length,
      parentBDelta: reporter === 'parent_b' ? -affected.length : affected.length,
    },
    transitionImpact: 2, // adds 2 transitions (handoff + return)
    routineImpact: affected.length <= 1 ? 'minor' : 'moderate',
  });

  // ── Option B: Partial day coverage (if applicable) ──
  if (affected.length <= 2) {
    const partialDays = affected.map(date => ({
      date,
      parent: other,
      type: 'partial_day_coverage' as CoverageType,
    }));

    options.push({
      id: `${disruption.id}-B`,
      label: 'Partial day coverage',
      description: `${otherLabel} handles school pickup/dropoff. ${reporterLabel} keeps overnight. No custody change.`,
      coverageDays: partialDays,
      compensationDays: [], // no compensation needed — no custody shift
      fairnessImpact: { parentADelta: 0, parentBDelta: 0 },
      transitionImpact: 0,
      routineImpact: 'minor',
    });
  }

  // ── Option C: Shortened coverage (if multi-day) ──
  if (affected.length >= 2) {
    const shortened = affected.slice(0, Math.ceil(affected.length / 2));
    const shortenedCoverage = shortened.map(date => ({
      date,
      parent: other,
      type: 'full_custody_transfer' as CoverageType,
    }));

    const shortCompensation = findCompensationDays(
      schedule, currentDay, shortened.length, reporter, other,
    );

    options.push({
      id: `${disruption.id}-C`,
      label: `${otherLabel} covers ${shortened.length} day${shortened.length > 1 ? 's' : ''}, reevaluate after`,
      description: `${otherLabel} covers ${formatDateRange(shortened)}. Reevaluate ${affected[shortened.length] || 'next day'}.`,
      coverageDays: shortenedCoverage,
      compensationDays: shortCompensation,
      fairnessImpact: {
        parentADelta: reporter === 'parent_a' ? -shortened.length : shortened.length,
        parentBDelta: reporter === 'parent_b' ? -shortened.length : shortened.length,
      },
      transitionImpact: 2,
      routineImpact: 'minor',
    });
  }

  return {
    disruptionId: disruption.id,
    options,
    generatedAt: new Date().toISOString(),
  };
}

// ── Find Compensation Days ──
// Deterministically finds days in the next 2 weeks where the reporter
// can receive extra time to compensate for coverage given.

function findCompensationDays(
  schedule: ScheduleDay[],
  currentDay: number,
  count: number,
  reporter: 'parent_a' | 'parent_b',
  other: 'parent_a' | 'parent_b',
): Array<{ date: string; parent: 'parent_a' | 'parent_b' }> {
  const result: Array<{ date: string; parent: 'parent_a' | 'parent_b' }> = [];
  // Look 7-21 days ahead for days currently assigned to `other`
  // that can be given back to `reporter`
  const searchStart = currentDay + 7;
  const searchEnd = Math.min(schedule.length, currentDay + 21);

  for (let i = searchStart; i < searchEnd && result.length < count; i++) {
    const day = schedule[i];
    if (day && day.assignedTo === other) {
      result.push({ date: day.date, parent: reporter });
    }
  }

  return result;
}

// ── Format Helpers ──

function formatDateRange(dates: string[]): string {
  if (dates.length === 0) return 'no days';
  if (dates.length === 1) {
    return formatShortDate(dates[0]);
  }
  return `${formatShortDate(dates[0])}–${formatShortDate(dates[dates.length - 1])}`;
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// ── Format Proposal for Display ──

export function formatProposalOption(
  option: ProposalOption,
  config: ScenarioConfig,
): string {
  const lines = [
    option.label,
    option.description,
    '',
    'Impact:',
  ];

  const aLabel = config.parentA.label;
  const bLabel = config.parentB.label;

  if (option.fairnessImpact.parentADelta !== 0) {
    const sign = option.fairnessImpact.parentADelta > 0 ? '+' : '';
    lines.push(`${aLabel}: ${sign}${option.fairnessImpact.parentADelta} nights`);
  }
  if (option.fairnessImpact.parentBDelta !== 0) {
    const sign = option.fairnessImpact.parentBDelta > 0 ? '+' : '';
    lines.push(`${bLabel}: ${sign}${option.fairnessImpact.parentBDelta} nights`);
  }
  if (option.fairnessImpact.parentADelta === 0 && option.fairnessImpact.parentBDelta === 0) {
    lines.push('No fairness impact.');
  }

  lines.push(`Transitions: ${option.transitionImpact === 0 ? 'unchanged' : `+${option.transitionImpact}`}`);
  lines.push(`Routine disruption: ${option.routineImpact}`);

  if (option.compensationDays.length > 0) {
    lines.push('');
    lines.push(`Compensation: ${formatDateRange(option.compensationDays.map(d => d.date))}`);
  }

  return lines.join('\n');
}

// ── Format Full Bundle ──

export function formatProposalBundle(
  bundle: ProposalBundle,
  config: ScenarioConfig,
): string {
  if (bundle.options.length === 0) {
    return 'No schedule adjustment options available. Base schedule remains in effect.';
  }

  const lines = [
    `${bundle.options.length} options generated.`,
    '',
  ];

  bundle.options.forEach((opt, i) => {
    lines.push(`Option ${i + 1}: ${opt.label}`);
    lines.push(opt.description);

    if (opt.fairnessImpact.parentADelta === 0 && opt.fairnessImpact.parentBDelta === 0) {
      lines.push('Fairness: no change.');
    } else {
      const aLabel = config.parentA.label;
      const bLabel = config.parentB.label;
      if (opt.fairnessImpact.parentADelta !== 0) {
        lines.push(`${aLabel}: ${opt.fairnessImpact.parentADelta > 0 ? '+' : ''}${opt.fairnessImpact.parentADelta} nights`);
      }
      if (opt.fairnessImpact.parentBDelta !== 0) {
        lines.push(`${bLabel}: ${opt.fairnessImpact.parentBDelta > 0 ? '+' : ''}${opt.fairnessImpact.parentBDelta} nights`);
      }
    }

    lines.push(`Routine impact: ${opt.routineImpact}`);
    lines.push('');
  });

  return lines.join('\n');
}
