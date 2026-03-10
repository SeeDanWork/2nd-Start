import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import {
  TimelineEvent,
  TimelineEventType,
  TimelineCheckpoint,
  TimelineConfig,
  TimelineStatus,
} from './timeline-event.types';
import { ConversationOrchestratorService } from '../messaging/conversation-orchestrator.service';
import { MetricsService } from '../metrics/metrics.service';

/**
 * TimelineEngine — accelerated simulation through live application services.
 *
 * Per SMS Pilot Contract: the simulator calls the same live services used
 * by real SMS traffic. It differs only in clock source (virtual), SMS transport
 * (in-memory), and identity resolution (seeded test families).
 *
 * The engine maintains an ordered event queue, a virtual clock, and checkpoints.
 * Events are processed sequentially through the real domain services.
 */
@Injectable()
export class TimelineEngineService {
  private readonly logger = new Logger(TimelineEngineService.name);

  // In-memory timeline state (one active timeline per family for now)
  private timelines = new Map<string, TimelineState>();

  constructor(
    private readonly orchestrator: ConversationOrchestratorService,
    private readonly metricsService: MetricsService,
  ) {}

  // ── Lifecycle ────────────────────────────────────────────────

  create(config: TimelineConfig): TimelineStatus {
    const id = uuid();
    const state: TimelineState = {
      id,
      config,
      currentDate: new Date(config.startDate),
      endDate: new Date(config.endDate),
      state: 'idle',
      eventQueue: [],
      processedEvents: [],
      checkpoints: [],
      smsLog: [],
      startedAt: null,
      lastAdvancedAt: null,
    };

    this.timelines.set(id, state);
    this.logger.log(`Timeline ${id} created for family ${config.familyId}: ${config.startDate} → ${config.endDate}`);
    return this.toStatus(state);
  }

  getStatus(timelineId: string): TimelineStatus | null {
    const state = this.timelines.get(timelineId);
    return state ? this.toStatus(state) : null;
  }

  listTimelines(familyId?: string): TimelineStatus[] {
    const all = Array.from(this.timelines.values());
    const filtered = familyId ? all.filter(t => t.config.familyId === familyId) : all;
    return filtered.map(t => this.toStatus(t));
  }

  destroy(timelineId: string): boolean {
    return this.timelines.delete(timelineId);
  }

  // ── Event Queue ──────────────────────────────────────────────

  enqueueEvent(timelineId: string, event: Omit<TimelineEvent, 'id'>): TimelineEvent {
    const state = this.getState(timelineId);
    const fullEvent: TimelineEvent = { ...event, id: uuid() };
    state.eventQueue.push(fullEvent);
    state.eventQueue.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
    return fullEvent;
  }

  enqueueEvents(timelineId: string, events: Omit<TimelineEvent, 'id'>[]): TimelineEvent[] {
    return events.map(e => this.enqueueEvent(timelineId, e));
  }

  /**
   * Seed the timeline with daily system events (handoff reminders,
   * fairness checks, budget resets) across the full date range.
   */
  seedSystemEvents(timelineId: string): number {
    const state = this.getState(timelineId);
    const { familyId } = state.config;
    let count = 0;
    const current = new Date(state.config.startDate);
    const end = new Date(state.config.endDate);

    while (current <= end) {
      // Daily advance
      this.enqueueEvent(timelineId, {
        type: TimelineEventType.ADVANCE_DAY,
        scheduledAt: new Date(current),
        actorId: null,
        familyId,
        payload: { date: current.toISOString().split('T')[0] },
      });

      // Handoff reminder at 8am each day
      const reminderTime = new Date(current);
      reminderTime.setHours(8, 0, 0, 0);
      this.enqueueEvent(timelineId, {
        type: TimelineEventType.HANDOFF_REMINDER,
        scheduledAt: reminderTime,
        actorId: null,
        familyId,
        payload: { date: current.toISOString().split('T')[0] },
      });

      // Weekly fairness check on Sundays
      if (current.getDay() === 0) {
        this.enqueueEvent(timelineId, {
          type: TimelineEventType.FAIRNESS_CHECK,
          scheduledAt: new Date(current),
          actorId: null,
          familyId,
          payload: {},
        });
      }

      // Monthly budget reset on 1st
      if (current.getDate() === 1) {
        this.enqueueEvent(timelineId, {
          type: TimelineEventType.BUDGET_RESET,
          scheduledAt: new Date(current),
          actorId: null,
          familyId,
          payload: {},
        });
      }

      count++;
      current.setDate(current.getDate() + 1);
    }

    this.logger.log(`Seeded ${state.eventQueue.length} system events for timeline ${timelineId}`);
    return state.eventQueue.length;
  }

  // ── Processing ───────────────────────────────────────────────

  /**
   * Process all events up to and including the target date.
   * Returns processed events with their results.
   */
  async advanceTo(timelineId: string, targetDate: string): Promise<TimelineEvent[]> {
    const state = this.getState(timelineId);
    state.state = 'running';
    state.startedAt = state.startedAt || new Date();

    const target = new Date(targetDate);
    target.setHours(23, 59, 59, 999);

    const processed: TimelineEvent[] = [];

    while (state.eventQueue.length > 0) {
      const next = state.eventQueue[0];
      if (next.scheduledAt > target) break;

      state.eventQueue.shift();
      const result = await this.processEvent(state, next);
      processed.push(result);
      state.processedEvents.push(result);
    }

    state.currentDate = target;
    state.lastAdvancedAt = new Date();

    if (state.eventQueue.length === 0 || state.currentDate >= state.endDate) {
      state.state = 'completed';
    } else {
      state.state = 'paused';
    }

    this.logger.log(`Advanced timeline ${timelineId} to ${targetDate}: ${processed.length} events processed`);
    return processed;
  }

  /**
   * Advance one day from current position.
   */
  async advanceOneDay(timelineId: string): Promise<TimelineEvent[]> {
    const state = this.getState(timelineId);
    const next = new Date(state.currentDate);
    next.setDate(next.getDate() + 1);
    return this.advanceTo(timelineId, next.toISOString().split('T')[0]);
  }

  /**
   * Run all remaining events to completion.
   */
  async runToCompletion(timelineId: string): Promise<TimelineEvent[]> {
    const state = this.getState(timelineId);
    return this.advanceTo(timelineId, state.config.endDate);
  }

  // ── Checkpoints ──────────────────────────────────────────────

  async createCheckpoint(timelineId: string, label: string): Promise<TimelineCheckpoint> {
    const state = this.getState(timelineId);

    let fairnessSnapshot: Record<string, unknown> | null = null;
    try {
      const today = await this.metricsService.getToday(state.config.familyId);
      fairnessSnapshot = today.fairness as Record<string, unknown>;
    } catch {
      // Metrics may not be available
    }

    const checkpoint: TimelineCheckpoint = {
      id: uuid(),
      timelineId,
      virtualDate: new Date(state.currentDate),
      createdAt: new Date(),
      label,
      stateSnapshot: {
        currentDate: state.currentDate.toISOString().split('T')[0],
        eventsProcessed: state.processedEvents.length,
        activeScheduleVersionId: null,
        pendingRequestIds: [],
        fairnessSnapshot,
      },
    };

    state.checkpoints.push(checkpoint);
    this.logger.log(`Checkpoint "${label}" created at ${checkpoint.stateSnapshot.currentDate}`);
    return checkpoint;
  }

  // ── SMS Log ──────────────────────────────────────────────────

  getSmsLog(timelineId: string): SmsLogEntry[] {
    const state = this.getState(timelineId);
    return state.smsLog;
  }

  // ── Private ──────────────────────────────────────────────────

  private async processEvent(state: TimelineState, event: TimelineEvent): Promise<TimelineEvent> {
    const startTime = Date.now();

    try {
      switch (event.type) {
        case TimelineEventType.INBOUND_MESSAGE: {
          const phone = event.payload.phoneNumber as string;
          const body = event.payload.messageBody as string;
          const reply = await this.orchestrator.handleInboundSms(phone, body);

          state.smsLog.push({
            timestamp: event.scheduledAt,
            direction: 'inbound',
            phoneNumber: phone,
            body,
            actorId: event.actorId,
          });
          state.smsLog.push({
            timestamp: new Date(event.scheduledAt.getTime() + 1000),
            direction: 'outbound',
            phoneNumber: phone,
            body: reply,
            actorId: null,
          });

          event.result = { reply, durationMs: Date.now() - startTime };
          break;
        }

        case TimelineEventType.DISRUPTION_REPORTED:
        case TimelineEventType.SWAP_REQUESTED:
        case TimelineEventType.COVERAGE_REQUESTED:
        case TimelineEventType.EXTRA_TIME_REQUESTED: {
          // These route through the orchestrator as SMS messages
          const intentMap: Record<string, string> = {
            [TimelineEventType.DISRUPTION_REPORTED]: 'sick',
            [TimelineEventType.SWAP_REQUESTED]: 'swap',
            [TimelineEventType.COVERAGE_REQUESTED]: 'cover',
            [TimelineEventType.EXTRA_TIME_REQUESTED]: 'extra time',
          };
          const dates = (event.payload.dates as string[]) || [];
          const keyword = intentMap[event.type] || 'cover';
          const messageBody = `${keyword} ${dates.join(' ')}`;
          const phone = event.payload.phoneNumber as string;

          const reply = await this.orchestrator.handleInboundSms(phone, messageBody);

          state.smsLog.push(
            { timestamp: event.scheduledAt, direction: 'inbound', phoneNumber: phone, body: messageBody, actorId: event.actorId },
            { timestamp: new Date(event.scheduledAt.getTime() + 1000), direction: 'outbound', phoneNumber: phone, body: reply, actorId: null },
          );

          event.result = { reply, durationMs: Date.now() - startTime };
          break;
        }

        case TimelineEventType.PROPOSAL_ACCEPTED:
        case TimelineEventType.PROPOSAL_DECLINED: {
          const keyword = event.type === TimelineEventType.PROPOSAL_ACCEPTED ? 'accept' : 'decline';
          const optionNum = event.payload.optionNumber ? ` ${event.payload.optionNumber}` : '';
          const phone = event.payload.phoneNumber as string;
          const messageBody = `${keyword}${optionNum}`;

          const reply = await this.orchestrator.handleInboundSms(phone, messageBody);

          state.smsLog.push(
            { timestamp: event.scheduledAt, direction: 'inbound', phoneNumber: phone, body: messageBody, actorId: event.actorId },
            { timestamp: new Date(event.scheduledAt.getTime() + 1000), direction: 'outbound', phoneNumber: phone, body: reply, actorId: null },
          );

          event.result = { reply, durationMs: Date.now() - startTime };
          break;
        }

        case TimelineEventType.ADVANCE_DAY:
        case TimelineEventType.HANDOFF_REMINDER:
        case TimelineEventType.FAIRNESS_CHECK:
        case TimelineEventType.BUDGET_RESET:
        case TimelineEventType.PRECONFLICT_ALERT:
        case TimelineEventType.PROPOSAL_EXPIRED:
        case TimelineEventType.SCHEDULE_GENERATED:
        case TimelineEventType.SCHEDULE_VERSION_ACTIVATED:
        case TimelineEventType.CHECKPOINT:
          // System events — logged but no orchestrator call needed
          event.result = { status: 'noted', durationMs: Date.now() - startTime };
          break;

        default:
          event.result = { status: 'unknown_event_type' };
      }
    } catch (err: any) {
      this.logger.error(`Event ${event.id} (${event.type}) failed: ${err.message}`);
      event.error = err.message;
      event.result = { status: 'error', error: err.message, durationMs: Date.now() - startTime };
    }

    event.processedAt = new Date();
    return event;
  }

  private getState(timelineId: string): TimelineState {
    const state = this.timelines.get(timelineId);
    if (!state) throw new Error(`Timeline ${timelineId} not found`);
    return state;
  }

  private toStatus(state: TimelineState): TimelineStatus {
    return {
      id: state.id,
      familyId: state.config.familyId,
      config: state.config,
      currentDate: state.currentDate.toISOString().split('T')[0],
      state: state.state,
      eventsProcessed: state.processedEvents.length,
      eventsRemaining: state.eventQueue.length,
      checkpoints: state.checkpoints,
      startedAt: state.startedAt,
      lastAdvancedAt: state.lastAdvancedAt,
    };
  }
}

// ── Internal Types ─────────────────────────────────────────

interface TimelineState {
  id: string;
  config: TimelineConfig;
  currentDate: Date;
  endDate: Date;
  state: 'idle' | 'running' | 'paused' | 'completed';
  eventQueue: TimelineEvent[];
  processedEvents: TimelineEvent[];
  checkpoints: TimelineCheckpoint[];
  smsLog: SmsLogEntry[];
  startedAt: Date | null;
  lastAdvancedAt: Date | null;
}

export interface SmsLogEntry {
  timestamp: Date;
  direction: 'inbound' | 'outbound';
  phoneNumber: string;
  body: string;
  actorId: string | null;
}
