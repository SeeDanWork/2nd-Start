/**
 * SMS Reply Templates — artifact-backed rendering.
 *
 * Every consequential SMS reply is generated from saved structured artifacts
 * (ProposalOption, LedgerSnapshot, ExplanationArtifact), not ad-hoc text.
 *
 * All templates target ≤160 chars (single segment) or ≤320 chars (two segments).
 * Tone: factual, calm, brief. No custody language. No emotional language.
 */

import { ProposalOption } from '../entities';

// ── Types ──────────────────────────────────────────────────

export interface StatusData {
  tonightParent: string | null;
  nextHandoffDate: string | null;
  fairnessDelta: number | null;
  windowWeeks: number | null;
  pendingRequests: number;
}

export interface ProposalSummaryData {
  optionCount: number;
  dates: string[];
  requestType: string;
  reviewUrl: string | null;
  options: ProposalOptionSnapshot[];
}

export interface ProposalOptionSnapshot {
  rank: number;
  label: string | null;
  penaltyScore: number;
  isAutoApprovable: boolean;
  fairnessAssessment: 'favorable' | 'neutral' | 'unfavorable' | null;
  overnightDelta: number | null;
  transitionsDelta: number | null;
  changedDates: number;
}

export interface AcceptedData {
  dates: string[];
  optionRank: number;
  newVersionNumber: number | null;
}

export interface DeclinedData {
  dates: string[];
}

export interface PreConflictAlertData {
  severity: 'warning' | 'critical';
  message: string;
  metric: string;
  currentValue: number;
  thresholdValue: number;
}

export interface HandoffReminderData {
  date: string;
  fromParent: string;
  toParent: string;
  timeWindow: string | null;
}

// ── Template Functions ─────────────────────────────────────

export function renderStatusReply(data: StatusData): string {
  const parts: string[] = [];

  if (data.tonightParent) {
    parts.push(`Tonight: ${formatParent(data.tonightParent)}`);
  } else {
    parts.push('No schedule set.');
  }

  if (data.nextHandoffDate) {
    parts.push(`Handoff: ${formatShortDate(data.nextHandoffDate)}`);
  }

  if (data.fairnessDelta !== null) {
    const sign = data.fairnessDelta >= 0 ? '+' : '';
    parts.push(`Balance: ${sign}${data.fairnessDelta} nights (${data.windowWeeks || 8}wk)`);
  }

  if (data.pendingRequests > 0) {
    parts.push(`${data.pendingRequests} pending`);
  }

  return parts.join(' | ');
}

export function renderProposalSummary(data: ProposalSummaryData): string {
  const dateStr = formatDateList(data.dates);
  const typeStr = friendlyType(data.requestType);

  if (data.optionCount === 0) {
    return `${capitalize(typeStr)} created for ${dateStr}. No proposals could be generated.`;
  }

  const parts: string[] = [];
  parts.push(`${data.optionCount} option(s) for ${dateStr}.`);

  // Show top option summary if available
  if (data.options.length > 0) {
    const top = data.options[0];
    const assessment = top.fairnessAssessment || 'neutral';
    parts.push(`Top: ${assessment}, ${top.changedDates} day(s) changed.`);
  }

  if (data.reviewUrl) {
    parts.push(`Review: ${data.reviewUrl}`);
  }

  parts.push('Reply ACCEPT or DECLINE.');

  return parts.join(' ');
}

export function renderProposalDetail(option: ProposalOptionSnapshot, index: number): string {
  const parts: string[] = [];
  parts.push(`Option ${index + 1}:`);

  const assessment = option.fairnessAssessment || 'neutral';
  parts.push(assessment);

  if (option.overnightDelta !== null && option.overnightDelta !== 0) {
    const sign = option.overnightDelta >= 0 ? '+' : '';
    parts.push(`${sign}${option.overnightDelta} nights`);
  }

  parts.push(`${option.changedDates} day(s) changed`);

  if (option.isAutoApprovable) {
    parts.push('auto-ok');
  }

  return parts.join(', ');
}

export function renderAcceptedReply(data: AcceptedData): string {
  const dateStr = formatDateList(data.dates);
  const version = data.newVersionNumber ? ` v${data.newVersionNumber}` : '';
  return `Schedule updated${version} for ${dateStr}.`;
}

export function renderDeclinedReply(data: DeclinedData): string {
  return `Declined. No changes for ${formatDateList(data.dates)}.`;
}

export function renderPreConflictAlert(data: PreConflictAlertData): string {
  const severity = data.severity === 'critical' ? 'ALERT' : 'Notice';
  return `${severity}: ${data.message}`;
}

export function renderHandoffReminder(data: HandoffReminderData): string {
  const dateStr = formatShortDate(data.date);
  const time = data.timeWindow ? ` at ${data.timeWindow}` : '';
  return `Handoff ${dateStr}${time}. ${formatParent(data.fromParent)} to ${formatParent(data.toParent)}.`;
}

export function renderBudgetExhausted(): string {
  return 'Monthly change budget used. No more requests this month.';
}

export function renderNoActiveSchedule(): string {
  return 'No active schedule. Set up your schedule first.';
}

export function renderHelp(): string {
  return 'STATUS, SWAP [date], COVER [date], SICK [date], ACCEPT [1-3], DECLINE, HELP, STOP';
}

export function renderUnknownIntent(): string {
  return 'Not understood. Reply HELP for commands.';
}

export function renderUnregistered(): string {
  return 'Number not registered. Add your phone in Settings to use SMS.';
}

export function renderUnsubscribed(): string {
  return 'Unsubscribed. Reply START to re-subscribe.';
}

export function renderConfirmRequest(requestType: string, dates: string[]): string {
  return `Create ${friendlyType(requestType)} for ${formatDateList(dates)}? Reply YES or NO.`;
}

export function renderCancelled(): string {
  return 'Cancelled. No changes made.';
}

export function renderNoPending(): string {
  return 'No pending proposals.';
}

export function renderError(): string {
  return 'Something went wrong. Try again later.';
}

// ── Helpers ────────────────────────────────────────────────

function formatParent(role: string): string {
  if (role === 'parent_a') return 'Parent A';
  if (role === 'parent_b') return 'Parent B';
  return role;
}

function formatShortDate(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  } catch {
    return isoDate;
  }
}

function formatDateList(dates: string[]): string {
  if (dates.length <= 3) {
    return dates.map(formatShortDate).join(', ');
  }
  return `${dates.map(formatShortDate).slice(0, 2).join(', ')} +${dates.length - 2} more`;
}

function friendlyType(type: string): string {
  switch (type) {
    case 'NEED_COVERAGE': return 'coverage request';
    case 'SWAP_DATE': return 'swap';
    case 'WANT_TIME': return 'extra time request';
    case 'BONUS_WEEK': return 'bonus week request';
    default: return 'request';
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Snapshot Builders ──────────────────────────────────────

export function buildOptionSnapshot(option: ProposalOption): ProposalOptionSnapshot {
  const calendarDiff = (option.calendarDiff as any[]) || [];
  const fairness = option.fairnessImpact as any;
  const stability = option.stabilityImpact as any;

  return {
    rank: option.rank,
    label: option.label,
    penaltyScore: option.penaltyScore,
    isAutoApprovable: option.isAutoApprovable,
    fairnessAssessment: assessFairness(fairness),
    overnightDelta: fairness?.overnightDelta ?? null,
    transitionsDelta: stability?.transitionsDelta ?? null,
    changedDates: calendarDiff.length,
  };
}

function assessFairness(impact: any): 'favorable' | 'neutral' | 'unfavorable' | null {
  if (!impact) return null;
  const delta = Math.abs(impact.overnightDelta ?? 0);
  const weekendDelta = Math.abs(impact.weekendDelta ?? 0);
  if (delta <= 1 && weekendDelta <= 1) return 'favorable';
  if (delta <= 3 && weekendDelta <= 2) return 'neutral';
  return 'unfavorable';
}
