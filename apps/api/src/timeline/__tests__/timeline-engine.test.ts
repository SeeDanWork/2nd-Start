import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TimelineEngineService } from '../timeline-engine.service';
import { TimelineEventType } from '../timeline-event.types';

// Mock services
const mockOrchestrator = {
  handleInboundSms: vi.fn().mockResolvedValue('Reply from system'),
};

const mockMetrics = {
  getToday: vi.fn().mockResolvedValue({
    tonight: { parent: 'parent_a' },
    nextHandoff: { date: '2026-03-15' },
    fairness: { delta: 1, windowWeeks: 8 },
    pendingRequests: 0,
  }),
};

const mockGuardrails = {
  resetMonthlyBudgets: vi.fn().mockResolvedValue(3),
};

const mockPreConflict = {
  runDailyCheck: vi.fn().mockResolvedValue({
    familyId: 'family-1',
    alerts: [
      { type: 'overnight_imbalance', severity: 'warning', metric: 'overnightDelta', message: 'Test alert' },
    ],
  }),
};

const mockSmsService = {
  send: vi.fn().mockResolvedValue(undefined),
};

describe('TimelineEngineService', () => {
  let engine: TimelineEngineService;
  const familyId = 'family-1';

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new TimelineEngineService(
      mockOrchestrator as any,
      mockMetrics as any,
      mockGuardrails as any,
      mockPreConflict as any,
      mockSmsService as any,
    );
  });

  describe('Lifecycle', () => {
    it('creates a timeline', () => {
      const status = engine.create({
        familyId,
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        speedMultiplier: 1,
        autoAdvance: false,
        parentPersonas: { parentA: null, parentB: null },
      });
      expect(status.id).toBeDefined();
      expect(status.familyId).toBe(familyId);
      expect(status.state).toBe('idle');
      expect(status.eventsRemaining).toBe(0);
    });

    it('lists timelines', () => {
      engine.create({
        familyId,
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        speedMultiplier: 1,
        autoAdvance: false,
        parentPersonas: { parentA: null, parentB: null },
      });
      const list = engine.listTimelines();
      expect(list.length).toBe(1);
    });

    it('destroys a timeline', () => {
      const status = engine.create({
        familyId,
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        speedMultiplier: 1,
        autoAdvance: false,
        parentPersonas: { parentA: null, parentB: null },
      });
      expect(engine.destroy(status.id)).toBe(true);
      expect(engine.getStatus(status.id)).toBeNull();
    });
  });

  describe('Event Queue', () => {
    it('enqueues and sorts events by time', () => {
      const status = engine.create({
        familyId,
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        speedMultiplier: 1,
        autoAdvance: false,
        parentPersonas: { parentA: null, parentB: null },
      });

      engine.enqueueEvent(status.id, {
        type: TimelineEventType.ADVANCE_DAY,
        scheduledAt: new Date('2026-03-02'),
        actorId: null,
        familyId,
        payload: {},
      });
      engine.enqueueEvent(status.id, {
        type: TimelineEventType.ADVANCE_DAY,
        scheduledAt: new Date('2026-03-01'),
        actorId: null,
        familyId,
        payload: {},
      });

      const updated = engine.getStatus(status.id)!;
      expect(updated.eventsRemaining).toBe(2);
    });

    it('seeds system events', () => {
      const status = engine.create({
        familyId,
        startDate: '2026-03-01',
        endDate: '2026-03-07',
        speedMultiplier: 1,
        autoAdvance: false,
        parentPersonas: { parentA: null, parentB: null },
      });

      const count = engine.seedSystemEvents(status.id);
      expect(count).toBeGreaterThan(0);
      const updated = engine.getStatus(status.id)!;
      expect(updated.eventsRemaining).toBeGreaterThan(7); // At least 7 days + reminders
    });
  });

  describe('INBOUND_MESSAGE processing', () => {
    it('routes SMS through orchestrator', async () => {
      const status = engine.create({
        familyId,
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        speedMultiplier: 1,
        autoAdvance: false,
        parentPersonas: { parentA: null, parentB: null },
      });

      engine.enqueueEvent(status.id, {
        type: TimelineEventType.INBOUND_MESSAGE,
        scheduledAt: new Date('2026-03-01T10:00:00'),
        actorId: 'user-1',
        familyId,
        payload: { phoneNumber: '+1234567890', messageBody: 'status' },
      });

      const processed = await engine.advanceTo(status.id, '2026-03-02');
      expect(processed.length).toBe(1);
      expect(mockOrchestrator.handleInboundSms).toHaveBeenCalledWith('+1234567890', 'status');
      expect(processed[0].result).toHaveProperty('reply', 'Reply from system');

      // Check SMS log
      const log = engine.getSmsLog(status.id);
      expect(log.length).toBe(2); // inbound + outbound
      expect(log[0].direction).toBe('inbound');
      expect(log[1].direction).toBe('outbound');
    });
  });

  describe('System event processing (contract compliance)', () => {
    it('FAIRNESS_CHECK calls MetricsService.getToday()', async () => {
      const status = engine.create({
        familyId,
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        speedMultiplier: 1,
        autoAdvance: false,
        parentPersonas: { parentA: null, parentB: null },
      });

      engine.enqueueEvent(status.id, {
        type: TimelineEventType.FAIRNESS_CHECK,
        scheduledAt: new Date('2026-03-01'),
        actorId: null,
        familyId,
        payload: {},
      });

      const processed = await engine.advanceTo(status.id, '2026-03-01');
      expect(processed.length).toBe(1);
      expect(mockMetrics.getToday).toHaveBeenCalledWith(familyId);
      expect(processed[0].result?.status).toBe('processed');
      expect(processed[0].result).toHaveProperty('fairness');
    });

    it('BUDGET_RESET calls GuardrailsService.resetMonthlyBudgets()', async () => {
      const status = engine.create({
        familyId,
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        speedMultiplier: 1,
        autoAdvance: false,
        parentPersonas: { parentA: null, parentB: null },
      });

      engine.enqueueEvent(status.id, {
        type: TimelineEventType.BUDGET_RESET,
        scheduledAt: new Date('2026-04-01'),
        actorId: null,
        familyId,
        payload: {},
      });

      const processed = await engine.advanceTo(status.id, '2026-04-01');
      expect(processed.length).toBe(1);
      expect(mockGuardrails.resetMonthlyBudgets).toHaveBeenCalled();
      expect(processed[0].result?.status).toBe('processed');
      expect(processed[0].result?.budgetsReset).toBe(3);
    });

    it('PRECONFLICT_ALERT calls PreConflictService.runDailyCheck()', async () => {
      const status = engine.create({
        familyId,
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        speedMultiplier: 1,
        autoAdvance: false,
        parentPersonas: { parentA: null, parentB: null },
      });

      engine.enqueueEvent(status.id, {
        type: TimelineEventType.PRECONFLICT_ALERT,
        scheduledAt: new Date('2026-03-01'),
        actorId: null,
        familyId,
        payload: { date: '2026-03-01' },
      });

      const processed = await engine.advanceTo(status.id, '2026-03-01');
      expect(processed.length).toBe(1);
      expect(mockPreConflict.runDailyCheck).toHaveBeenCalledWith(familyId, '2026-03-01');
      expect(processed[0].result?.status).toBe('processed');
      expect(processed[0].result?.alertCount).toBe(1);
    });

    it('HANDOFF_REMINDER generates SMS log entry', async () => {
      const status = engine.create({
        familyId,
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        speedMultiplier: 1,
        autoAdvance: false,
        parentPersonas: { parentA: null, parentB: null },
      });

      engine.enqueueEvent(status.id, {
        type: TimelineEventType.HANDOFF_REMINDER,
        scheduledAt: new Date('2026-03-01T08:00:00'),
        actorId: null,
        familyId,
        payload: { date: '2026-03-01' },
      });

      const processed = await engine.advanceTo(status.id, '2026-03-02');
      expect(processed.length).toBe(1);
      expect(processed[0].result?.status).toBe('processed');
      expect(processed[0].result?.reminder).toContain('Handoff');

      const log = engine.getSmsLog(status.id);
      expect(log.length).toBe(1);
      expect(log[0].direction).toBe('outbound');
      expect(log[0].body).toContain('Handoff');
    });

    it('service errors are gracefully handled', async () => {
      mockMetrics.getToday.mockRejectedValueOnce(new Error('DB connection failed'));

      const status = engine.create({
        familyId,
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        speedMultiplier: 1,
        autoAdvance: false,
        parentPersonas: { parentA: null, parentB: null },
      });

      engine.enqueueEvent(status.id, {
        type: TimelineEventType.FAIRNESS_CHECK,
        scheduledAt: new Date('2026-03-01'),
        actorId: null,
        familyId,
        payload: {},
      });

      const processed = await engine.advanceTo(status.id, '2026-03-01');
      expect(processed.length).toBe(1);
      expect(processed[0].result?.status).toBe('skipped');
      expect(processed[0].result?.reason).toContain('DB connection failed');
    });
  });

  describe('Checkpoints', () => {
    it('creates a checkpoint with fairness snapshot', async () => {
      const status = engine.create({
        familyId,
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        speedMultiplier: 1,
        autoAdvance: false,
        parentPersonas: { parentA: null, parentB: null },
      });

      const checkpoint = await engine.createCheckpoint(status.id, 'week-1');
      expect(checkpoint.label).toBe('week-1');
      expect(checkpoint.stateSnapshot.currentDate).toBeDefined();
      expect(mockMetrics.getToday).toHaveBeenCalledWith(familyId);
    });
  });

  describe('Processing control', () => {
    it('advance one day processes events up to next day', async () => {
      const status = engine.create({
        familyId,
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        speedMultiplier: 1,
        autoAdvance: false,
        parentPersonas: { parentA: null, parentB: null },
      });

      engine.enqueueEvent(status.id, {
        type: TimelineEventType.ADVANCE_DAY,
        scheduledAt: new Date('2026-03-02'),
        actorId: null,
        familyId,
        payload: {},
      });

      const processed = await engine.advanceOneDay(status.id);
      expect(processed.length).toBe(1);
    });

    it('runToCompletion processes all events', async () => {
      const status = engine.create({
        familyId,
        startDate: '2026-03-01',
        endDate: '2026-03-03',
        speedMultiplier: 1,
        autoAdvance: false,
        parentPersonas: { parentA: null, parentB: null },
      });

      for (let day = 1; day <= 3; day++) {
        engine.enqueueEvent(status.id, {
          type: TimelineEventType.ADVANCE_DAY,
          scheduledAt: new Date(`2026-03-0${day}`),
          actorId: null,
          familyId,
          payload: {},
        });
      }

      const processed = await engine.runToCompletion(status.id);
      expect(processed.length).toBe(3);
      const finalStatus = engine.getStatus(status.id)!;
      expect(finalStatus.state).toBe('completed');
    });
  });
});
