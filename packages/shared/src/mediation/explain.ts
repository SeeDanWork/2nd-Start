import { FairnessImpact, StabilityImpact, HandoffImpact } from '../types';
import { FairnessExplanation, LabeledCalendarDiff } from './types';

/**
 * Generates a human-readable fairness explanation for a proposal option.
 */
export function explainProposal(
  fairnessImpact: FairnessImpact,
  stabilityImpact: StabilityImpact,
  handoffImpact: HandoffImpact,
  labeledDiffs: LabeledCalendarDiff[],
): FairnessExplanation {
  return {
    fairnessDeltaText: describeFairnessDelta(
      fairnessImpact.overnightDelta,
      fairnessImpact.weekendDelta,
      fairnessImpact.windowWeeks,
    ),
    transitionImpactText: describeTransitionImpact(
      stabilityImpact.transitionsDelta,
      stabilityImpact.maxStreakChange,
      stabilityImpact.schoolNightChanges,
    ),
    routineImpactText: describeRoutineImpact(
      handoffImpact,
      stabilityImpact.schoolNightChanges,
    ),
    compensationSummary: describeCompensation(labeledDiffs),
    overallAssessment: assessOverall(
      fairnessImpact.overnightDelta,
      stabilityImpact.transitionsDelta,
    ),
  };
}

/**
 * Describes the fairness delta in plain language.
 */
export function describeFairnessDelta(
  overnightDelta: number,
  weekendDelta: number,
  windowWeeks: number,
): string {
  const parts: string[] = [];

  if (overnightDelta === 0 && weekendDelta === 0) {
    return 'No change to overnight or weekend balance.';
  }

  if (overnightDelta !== 0) {
    const direction = overnightDelta > 0 ? '+' : '';
    const who = overnightDelta > 0 ? 'Parent A' : 'Parent B';
    const nights = Math.abs(overnightDelta);
    parts.push(`${who} ${direction}${overnightDelta} night${nights !== 1 ? 's' : ''}`);
  }

  if (weekendDelta !== 0) {
    const direction = weekendDelta > 0 ? '+' : '';
    parts.push(`weekend balance ${direction}${weekendDelta}`);
  }

  const suffix = windowWeeks > 0
    ? `. Balance measured over ${windowWeeks}-week window.`
    : '.';

  return parts.join(', ') + suffix;
}

/**
 * Describes the transition impact of a proposal.
 */
export function describeTransitionImpact(
  transitionsDelta: number,
  maxStreakChange: number,
  schoolNightChanges: number,
): string {
  if (transitionsDelta === 0 && maxStreakChange === 0 && schoolNightChanges === 0) {
    return 'No additional transitions.';
  }

  const parts: string[] = [];

  if (transitionsDelta !== 0) {
    const verb = transitionsDelta > 0 ? 'Adds' : 'Removes';
    parts.push(`${verb} ${Math.abs(transitionsDelta)} transition${Math.abs(transitionsDelta) !== 1 ? 's' : ''}`);
  }

  if (maxStreakChange !== 0) {
    const direction = maxStreakChange > 0 ? 'increases' : 'decreases';
    parts.push(`longest streak ${direction} by ${Math.abs(maxStreakChange)}`);
  }

  if (schoolNightChanges > 0) {
    parts.push(`${schoolNightChanges} school night${schoolNightChanges !== 1 ? 's' : ''} affected`);
  }

  return parts.join('; ') + '.';
}

/**
 * Describes routine impact (handoffs and school nights).
 */
export function describeRoutineImpact(
  handoffImpact: HandoffImpact,
  schoolNightChanges: number,
): string {
  const parts: string[] = [];

  if (schoolNightChanges === 0) {
    parts.push('No school night changes');
  } else {
    parts.push(`${schoolNightChanges} school night${schoolNightChanges !== 1 ? 's' : ''} affected`);
  }

  const netHandoffs = handoffImpact.newHandoffs - handoffImpact.removedHandoffs;
  if (netHandoffs > 0) {
    parts.push(`${netHandoffs} new handoff${netHandoffs !== 1 ? 's' : ''}`);
  } else if (netHandoffs < 0) {
    parts.push(`${Math.abs(netHandoffs)} fewer handoff${Math.abs(netHandoffs) !== 1 ? 's' : ''}`);
  }

  if (handoffImpact.nonDaycareHandoffs > 0) {
    parts.push(`${handoffImpact.nonDaycareHandoffs} non-daycare handoff${handoffImpact.nonDaycareHandoffs !== 1 ? 's' : ''}`);
  }

  return parts.join('; ') + '.';
}

/**
 * Summarizes compensation dates from labeled diffs.
 * Returns null if there are no compensation dates.
 */
export function describeCompensation(
  labeledDiffs: LabeledCalendarDiff[],
): string | null {
  const compensationDiffs = labeledDiffs.filter((d) => d.isCompensation);
  if (compensationDiffs.length === 0) return null;

  const dates = compensationDiffs.map((d) => d.date).sort();
  const recipient = compensationDiffs[0].newParent === 'parent_a' ? 'Parent A' : 'Parent B';

  if (dates.length === 1) {
    return `Compensation: ${recipient} receives ${dates[0]}.`;
  }

  // Check if dates are contiguous
  const isContiguous = dates.every((date, i) => {
    if (i === 0) return true;
    const prev = new Date(dates[i - 1] + 'T00:00:00Z');
    const curr = new Date(date + 'T00:00:00Z');
    return curr.getTime() - prev.getTime() === 86400000;
  });

  if (isContiguous) {
    return `Compensation: ${recipient} receives ${dates[0]} to ${dates[dates.length - 1]}.`;
  }

  return `Compensation: ${recipient} receives ${dates.join(', ')}.`;
}

/**
 * Determines overall assessment of a proposal based on key metrics.
 */
export function assessOverall(
  overnightDelta: number,
  transitionsDelta: number,
): 'favorable' | 'neutral' | 'unfavorable' {
  const fairnessImpact = Math.abs(overnightDelta);
  const totalImpact = fairnessImpact + Math.max(0, transitionsDelta);

  if (totalImpact === 0) return 'favorable';
  if (totalImpact <= 2) return 'neutral';
  return 'unfavorable';
}
