import { describe, it, expect } from 'vitest';
import {
  renderStatusReply,
  renderProposalSummary,
  renderProposalDetail,
  renderAcceptedReply,
  renderDeclinedReply,
  renderPreConflictAlert,
  renderHandoffReminder,
  renderHelp,
  renderUnknownIntent,
  renderUnregistered,
  renderUnsubscribed,
  renderConfirmRequest,
  renderCancelled,
  renderNoPending,
  renderError,
  renderBudgetExhausted,
  renderNoActiveSchedule,
  buildOptionSnapshot,
} from '../sms-reply-templates';

describe('SMS Reply Templates', () => {
  describe('renderStatusReply', () => {
    it('renders full status', () => {
      const result = renderStatusReply({
        tonightParent: 'parent_a',
        nextHandoffDate: '2026-03-05',
        fairnessDelta: 2,
        windowWeeks: 8,
        pendingRequests: 1,
      });
      expect(result).toContain('Parent A');
      expect(result).toContain('3/5');
      expect(result).toContain('+2 nights');
      expect(result).toContain('1 pending');
    });

    it('renders no schedule', () => {
      const result = renderStatusReply({
        tonightParent: null,
        nextHandoffDate: null,
        fairnessDelta: null,
        windowWeeks: null,
        pendingRequests: 0,
      });
      expect(result).toContain('No schedule set');
    });

    it('renders negative fairness delta', () => {
      const result = renderStatusReply({
        tonightParent: 'parent_b',
        nextHandoffDate: null,
        fairnessDelta: -3,
        windowWeeks: 8,
        pendingRequests: 0,
      });
      expect(result).toContain('-3 nights');
    });
  });

  describe('renderProposalSummary', () => {
    it('renders with options and review URL', () => {
      const result = renderProposalSummary({
        optionCount: 3,
        dates: ['2026-03-10', '2026-03-11'],
        requestType: 'SWAP_DATE',
        reviewUrl: 'http://localhost:3000/share/abc123',
        options: [{
          rank: 1,
          label: 'Option 1',
          penaltyScore: 5.0,
          isAutoApprovable: true,
          fairnessAssessment: 'favorable',
          overnightDelta: 0,
          transitionsDelta: 1,
          changedDates: 2,
        }],
      });
      expect(result).toContain('3 option(s)');
      expect(result).toContain('3/10');
      expect(result).toContain('favorable');
      expect(result).toContain('http://localhost:3000/share/abc123');
      expect(result).toContain('ACCEPT or DECLINE');
    });

    it('renders zero options', () => {
      const result = renderProposalSummary({
        optionCount: 0,
        dates: ['2026-03-10'],
        requestType: 'NEED_COVERAGE',
        reviewUrl: null,
        options: [],
      });
      expect(result).toContain('No proposals could be generated');
    });
  });

  describe('renderProposalDetail', () => {
    it('renders option detail', () => {
      const result = renderProposalDetail({
        rank: 1,
        label: 'Option 1',
        penaltyScore: 3.0,
        isAutoApprovable: true,
        fairnessAssessment: 'neutral',
        overnightDelta: -1,
        transitionsDelta: 0,
        changedDates: 1,
      }, 0);
      expect(result).toContain('Option 1');
      expect(result).toContain('neutral');
      expect(result).toContain('-1 nights');
      expect(result).toContain('auto-ok');
    });
  });

  describe('renderAcceptedReply', () => {
    it('renders with version number', () => {
      const result = renderAcceptedReply({
        dates: ['2026-03-10'],
        optionRank: 1,
        newVersionNumber: 7,
      });
      expect(result).toContain('v7');
      expect(result).toContain('3/10');
    });
  });

  describe('renderDeclinedReply', () => {
    it('renders decline', () => {
      const result = renderDeclinedReply({ dates: ['2026-03-10', '2026-03-11'] });
      expect(result).toContain('Declined');
      expect(result).toContain('3/10');
    });
  });

  describe('renderPreConflictAlert', () => {
    it('renders critical alert', () => {
      const result = renderPreConflictAlert({
        severity: 'critical',
        message: 'Fairness drift exceeds threshold',
        metric: 'overnightDelta',
        currentValue: 5,
        thresholdValue: 3,
      });
      expect(result).toContain('ALERT');
    });

    it('renders warning notice', () => {
      const result = renderPreConflictAlert({
        severity: 'warning',
        message: 'Budget running low',
        metric: 'changeBudget',
        currentValue: 1,
        thresholdValue: 2,
      });
      expect(result).toContain('Notice');
    });
  });

  describe('renderHandoffReminder', () => {
    it('renders with time window', () => {
      const result = renderHandoffReminder({
        date: '2026-03-05',
        fromParent: 'parent_a',
        toParent: 'parent_b',
        timeWindow: '3:00 PM',
      });
      expect(result).toContain('3/5');
      expect(result).toContain('3:00 PM');
      expect(result).toContain('Parent A');
      expect(result).toContain('Parent B');
    });
  });

  describe('static templates', () => {
    it('all return non-empty strings', () => {
      expect(renderHelp().length).toBeGreaterThan(0);
      expect(renderUnknownIntent().length).toBeGreaterThan(0);
      expect(renderUnregistered().length).toBeGreaterThan(0);
      expect(renderUnsubscribed().length).toBeGreaterThan(0);
      expect(renderCancelled().length).toBeGreaterThan(0);
      expect(renderNoPending().length).toBeGreaterThan(0);
      expect(renderError().length).toBeGreaterThan(0);
      expect(renderBudgetExhausted().length).toBeGreaterThan(0);
      expect(renderNoActiveSchedule().length).toBeGreaterThan(0);
    });
  });

  describe('renderConfirmRequest', () => {
    it('renders confirmation prompt', () => {
      const result = renderConfirmRequest('SWAP_DATE', ['2026-03-10']);
      expect(result).toContain('swap');
      expect(result).toContain('3/10');
      expect(result).toContain('YES or NO');
    });
  });

  describe('SMS length constraints', () => {
    it('status replies fit in 2 segments (320 chars)', () => {
      const result = renderStatusReply({
        tonightParent: 'parent_a',
        nextHandoffDate: '2026-03-05',
        fairnessDelta: 2,
        windowWeeks: 8,
        pendingRequests: 3,
      });
      expect(result.length).toBeLessThanOrEqual(320);
    });

    it('help fits in 1 segment (160 chars)', () => {
      expect(renderHelp().length).toBeLessThanOrEqual(160);
    });

    it('static messages fit in 1 segment', () => {
      expect(renderUnknownIntent().length).toBeLessThanOrEqual(160);
      expect(renderUnsubscribed().length).toBeLessThanOrEqual(160);
      expect(renderCancelled().length).toBeLessThanOrEqual(160);
      expect(renderNoPending().length).toBeLessThanOrEqual(160);
      expect(renderError().length).toBeLessThanOrEqual(160);
    });
  });

  describe('buildOptionSnapshot', () => {
    it('builds snapshot from ProposalOption-like object', () => {
      const option = {
        rank: 1,
        label: 'Option 1',
        penaltyScore: 5.0,
        isAutoApprovable: true,
        calendarDiff: [
          { date: '2026-03-10', old_parent: 'parent_a', new_parent: 'parent_b' },
        ],
        fairnessImpact: { overnightDelta: 0, weekendDelta: 0 },
        stabilityImpact: { transitionsDelta: 1 },
        handoffImpact: {},
      } as any;

      const snapshot = buildOptionSnapshot(option);
      expect(snapshot.rank).toBe(1);
      expect(snapshot.changedDates).toBe(1);
      expect(snapshot.fairnessAssessment).toBe('favorable');
      expect(snapshot.overnightDelta).toBe(0);
    });
  });
});
