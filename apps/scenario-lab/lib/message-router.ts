// ── Asymmetric Message Router ────────────────────────────────
// Routes different messages to each parent based on their role
// in the current disruption. Never mirrors messages.
//
// Message types follow structured protocol:
//   DISRUPTION_REPORT_CONFIRMATION
//   COVERAGE_REQUEST
//   DURATION_QUESTION
//   PROPOSAL_BUNDLE
//   PROPOSAL_SELECTED
//   CALCULATION_TRACE
//   SCHEDULE_UPDATE
//   FOLLOWUP_CHECK

import { ScenarioConfig, ScheduleDay } from './types';
import {
  ActiveDisruption,
  DISRUPTION_LABELS,
  DisruptionDuration,
  ProposalBundle,
} from './disruption-engine';
import { formatProposalBundle } from './proposal-generator';
import { snapshotMetrics } from './explanation-engine';

export type MessageType =
  | 'DISRUPTION_REPORT_CONFIRMATION'
  | 'DURATION_QUESTION'
  | 'COVERAGE_REQUEST'
  | 'PROPOSAL_BUNDLE'
  | 'PROPOSAL_SELECTED'
  | 'CALCULATION_TRACE'
  | 'SCHEDULE_UPDATE'
  | 'FOLLOWUP_CHECK'
  | 'DECLINE_CONFIRMATION'
  | 'MANAGE_SELF_CONFIRMATION';

export interface RoutedMessage {
  type: MessageType;
  recipient: 'parent_a' | 'parent_b';
  text: string;
}

// ── Get Parent Label ──

function label(parent: 'parent_a' | 'parent_b', config: ScenarioConfig): string {
  return parent === 'parent_a' ? config.parentA.label : config.parentB.label;
}

function childNames(config: ScenarioConfig): string {
  return config.children.map(c => c.name).join(' & ');
}

// ── Disruption Report Confirmation (to reporting parent) ──

export function disruptionReportConfirmation(
  disruption: ActiveDisruption,
  config: ScenarioConfig,
  schedule: ScheduleDay[],
  currentDay: number,
): RoutedMessage {
  const eventLabel = DISRUPTION_LABELS[disruption.eventType];
  const today = schedule[currentDay];
  const assignedToday = today
    ? (today.assignedTo === disruption.reportingParent ? 'you' : label(disruption.otherParent, config))
    : 'unknown';

  return {
    type: 'DISRUPTION_REPORT_CONFIRMATION',
    recipient: disruption.reportingParent,
    text: [
      `Event recorded: ${eventLabel}`,
      '',
      `${childNames(config)} scheduled with ${assignedToday} today.`,
      '',
      `Options:`,
      `1. Request coverage from ${label(disruption.otherParent, config)}`,
      `2. Manage myself`,
    ].join('\n'),
  };
}

// ── Duration Question ──

export function durationQuestion(
  disruption: ActiveDisruption,
): RoutedMessage {
  return {
    type: 'DURATION_QUESTION',
    recipient: disruption.reportingParent,
    text: [
      'How long do you expect the disruption to last?',
      '',
      '1. Today only',
      '2. 2-3 days',
      '3. About a week',
      '4. Not sure yet',
    ].join('\n'),
  };
}

// ── Coverage Request (to other parent) ──

export function coverageRequest(
  disruption: ActiveDisruption,
  config: ScenarioConfig,
): RoutedMessage {
  const reporterLabel = label(disruption.reportingParent, config);
  const eventLabel = DISRUPTION_LABELS[disruption.eventType];

  const durationText = disruption.duration === 'today_only' ? 'today'
    : disruption.duration === '2_3_days' ? '2-3 days'
    : disruption.duration === 'week' ? 'this week'
    : 'duration unknown';

  return {
    type: 'COVERAGE_REQUEST',
    recipient: disruption.otherParent,
    text: [
      `Coverage request from ${reporterLabel}.`,
      '',
      `${reporterLabel} reports: ${eventLabel.toLowerCase()}.`,
      `Estimated duration: ${durationText}.`,
      '',
      `Options:`,
      `1. View coverage options`,
      `2. Decline`,
    ].join('\n'),
  };
}

// ── Proposal Bundle (to other parent) ──

export function proposalBundleMessage(
  disruption: ActiveDisruption,
  bundle: ProposalBundle,
  config: ScenarioConfig,
): RoutedMessage {
  const formatted = formatProposalBundle(bundle, config);

  const choiceLines = bundle.options.map((opt, i) =>
    `${i + 1}. ${opt.label}`
  );
  choiceLines.push(`${bundle.options.length + 1}. Decline all`);

  return {
    type: 'PROPOSAL_BUNDLE',
    recipient: disruption.otherParent,
    text: [
      'Schedule options generated.',
      '',
      formatted,
      'Select an option:',
      ...choiceLines,
    ].join('\n'),
  };
}

// ── Proposal Selected (to both) ──

export function proposalSelectedMessage(
  disruption: ActiveDisruption,
  selectedLabel: string,
  config: ScenarioConfig,
  schedule: ScheduleDay[],
  currentDay: number,
): { reporter: RoutedMessage; other: RoutedMessage } {
  const otherLabel = label(disruption.otherParent, config);
  const snapshot = snapshotMetrics(schedule, currentDay, 56);
  const aLabel = config.parentA.label;
  const bLabel = config.parentB.label;

  const traceText = [
    `Schedule adjustment applied.`,
    '',
    `Selected: ${selectedLabel}`,
    '',
    `8-week fairness window:`,
    `${aLabel}: ${snapshot.parentANights} nights`,
    `${bLabel}: ${snapshot.parentBNights} nights`,
    `Transitions/week: ${snapshot.transitionsPerWeek}`,
    `Stability: ${snapshot.stabilityScore}`,
  ].join('\n');

  return {
    reporter: {
      type: 'CALCULATION_TRACE',
      recipient: disruption.reportingParent,
      text: [
        `${otherLabel} accepted coverage.`,
        '',
        traceText,
      ].join('\n'),
    },
    other: {
      type: 'CALCULATION_TRACE',
      recipient: disruption.otherParent,
      text: [
        `Coverage confirmed.`,
        '',
        traceText,
      ].join('\n'),
    },
  };
}

// ── Decline Confirmation ──

export function declineConfirmation(
  disruption: ActiveDisruption,
  config: ScenarioConfig,
): { reporter: RoutedMessage; other: RoutedMessage } {
  const otherLabel = label(disruption.otherParent, config);

  return {
    reporter: {
      type: 'DECLINE_CONFIRMATION',
      recipient: disruption.reportingParent,
      text: [
        `${otherLabel} declined coverage.`,
        'Base schedule remains in effect.',
        'No schedule changes applied.',
      ].join('\n'),
    },
    other: {
      type: 'DECLINE_CONFIRMATION',
      recipient: disruption.otherParent,
      text: [
        'Coverage declined.',
        'Base schedule remains in effect.',
      ].join('\n'),
    },
  };
}

// ── Manage Self Confirmation ──

export function manageSelfConfirmation(
  disruption: ActiveDisruption,
  config: ScenarioConfig,
): RoutedMessage {
  return {
    type: 'MANAGE_SELF_CONFIRMATION',
    recipient: disruption.reportingParent,
    text: [
      'Understood. No coverage request sent.',
      'Schedule unchanged.',
      '',
      'If you need coverage later, let me know.',
    ].join('\n'),
  };
}

// ── Follow-Up Check ──

export function followupCheck(
  disruption: ActiveDisruption,
  config: ScenarioConfig,
): RoutedMessage {
  const eventLabel = DISRUPTION_LABELS[disruption.eventType];

  return {
    type: 'FOLLOWUP_CHECK',
    recipient: disruption.reportingParent,
    text: [
      `Follow-up: ${eventLabel}`,
      '',
      'Are you ready to resume normal schedule?',
      '',
      '1. Yes -- resume normal schedule',
      '2. Not yet -- extend coverage',
    ].join('\n'),
  };
}

// ── Quick Action Labels ──

export function getQuickActions(
  disruption: ActiveDisruption | null,
  parent: 'parent_a' | 'parent_b',
): string[] {
  if (!disruption) return [];

  const isReporter = parent === disruption.reportingParent;

  switch (disruption.state) {
    case 'DISRUPTION_REPORTED':
      return isReporter ? ['Request coverage', 'Manage myself'] : [];

    case 'DURATION_ASKED':
      return isReporter ? ['Today only', '2-3 days', 'About a week', 'Not sure'] : [];

    case 'COVERAGE_REQUESTED':
    case 'PROPOSALS_GENERATED':
      if (!isReporter && disruption.proposals) {
        const labels = disruption.proposals.options.map((_, i) => `Option ${i + 1}`);
        labels.push('Decline');
        return labels;
      }
      return isReporter ? [] : ['View options', 'Decline'];

    case 'FOLLOWUP_PENDING':
      return isReporter ? ['Yes, resume', 'Not yet'] : [];

    default:
      return [];
  }
}
