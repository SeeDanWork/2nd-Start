import { Injectable, Logger } from '@nestjs/common';
import { PersonaProfile, PersonaAction, PersonaActionType } from './persona.types';
import { TimelineEventType, TimelineEvent } from '../timeline-event.types';

/**
 * PersonaEmulator — generates deterministic parent SMS actions from persona profiles.
 *
 * Given a persona and a date range, produces a sequence of TimelineEvents that
 * represent that parent's natural behavior (initiating requests, responding to
 * proposals, checking status, etc.).
 *
 * All randomness is seeded for reproducibility.
 */
@Injectable()
export class PersonaEmulatorService {
  private readonly logger = new Logger(PersonaEmulatorService.name);

  /**
   * Generate all actions for a persona over a date range.
   * Returns TimelineEvents ready to be enqueued.
   */
  generateActions(
    persona: PersonaProfile,
    familyId: string,
    startDate: string,
    endDate: string,
    seed: number = 42,
  ): Omit<TimelineEvent, 'id'>[] {
    const rng = createSeededRng(seed);
    const events: Omit<TimelineEvent, 'id'>[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const current = new Date(start);

    while (current <= end) {
      const dow = current.getDay();
      const dateStr = current.toISOString().split('T')[0];

      // Only generate actions during active hours
      const hour = persona.activeHours.start +
        Math.floor(rng() * (persona.activeHours.end - persona.activeHours.start));

      // Status check (roughly weekly)
      if (dow === 1 && rng() < persona.responsiveness * 0.5) {
        events.push(this.createEvent(
          TimelineEventType.INBOUND_MESSAGE,
          this.scheduledTime(current, hour),
          persona,
          familyId,
          { phoneNumber: persona.phoneNumber, messageBody: 'status' },
        ));
      }

      // Disruption report
      if (rng() < persona.disruptionFrequency / 7) {
        const disruptionDate = this.addDays(dateStr, Math.floor(rng() * 3));
        events.push(this.createEvent(
          TimelineEventType.INBOUND_MESSAGE,
          this.scheduledTime(current, hour + 1),
          persona,
          familyId,
          {
            phoneNumber: persona.phoneNumber,
            messageBody: `sick ${this.formatDateForSms(disruptionDate)}`,
          },
        ));
      }

      // Swap request on avoid days
      if (persona.avoidDays.includes(dow) && rng() < persona.initiationRate) {
        const targetDate = this.addDays(dateStr, 7 + Math.floor(rng() * 7));
        events.push(this.createEvent(
          TimelineEventType.INBOUND_MESSAGE,
          this.scheduledTime(current, hour),
          persona,
          familyId,
          {
            phoneNumber: persona.phoneNumber,
            messageBody: `swap ${this.formatDateForSms(targetDate)}`,
          },
        ));
      }

      // Coverage request
      if (rng() < persona.initiationRate / 14) {
        const coverDate = this.addDays(dateStr, 3 + Math.floor(rng() * 10));
        events.push(this.createEvent(
          TimelineEventType.INBOUND_MESSAGE,
          this.scheduledTime(current, hour + 2),
          persona,
          familyId,
          {
            phoneNumber: persona.phoneNumber,
            messageBody: `cover ${this.formatDateForSms(coverDate)}`,
          },
        ));
      }

      // Extra time request on preferred days
      if (persona.preferredDays.includes(dow) && rng() < persona.initiationRate / 10) {
        const extraDate = this.addDays(dateStr, 7);
        events.push(this.createEvent(
          TimelineEventType.INBOUND_MESSAGE,
          this.scheduledTime(current, hour),
          persona,
          familyId,
          {
            phoneNumber: persona.phoneNumber,
            messageBody: `extra time ${this.formatDateForSms(extraDate)}`,
          },
        ));
      }

      current.setDate(current.getDate() + 1);
    }

    this.logger.log(
      `Generated ${events.length} actions for persona "${persona.name}" ` +
      `(${startDate} → ${endDate})`,
    );

    return events;
  }

  /**
   * Generate a response action for when a proposal is received.
   * Based on persona cooperativeness and acceptThreshold.
   */
  generateProposalResponse(
    persona: PersonaProfile,
    familyId: string,
    proposalDate: Date,
    penaltyScore: number,
    seed: number = 42,
  ): Omit<TimelineEvent, 'id'> {
    const rng = createSeededRng(seed);
    const delayMinutes = persona.responseDelayMinutes.min +
      Math.floor(rng() * (persona.responseDelayMinutes.max - persona.responseDelayMinutes.min));
    const responseTime = new Date(proposalDate.getTime() + delayMinutes * 60 * 1000);

    // Decision: accept or decline based on cooperativeness and penalty score
    const willAccept = penaltyScore <= persona.acceptThreshold &&
      rng() < persona.cooperativeness;

    let messageBody: string;
    if (willAccept) {
      switch (persona.optionPreference) {
        case 'best_fairness':
          messageBody = 'accept 1';
          break;
        case 'least_change':
          messageBody = 'accept';
          break;
        default:
          messageBody = 'accept';
      }
    } else {
      messageBody = 'decline';
    }

    return this.createEvent(
      TimelineEventType.INBOUND_MESSAGE,
      responseTime,
      persona,
      familyId,
      { phoneNumber: persona.phoneNumber, messageBody },
    );
  }

  /**
   * Generate a confirmation response (YES/NO) for date confirmation prompts.
   */
  generateConfirmationResponse(
    persona: PersonaProfile,
    familyId: string,
    promptDate: Date,
    seed: number = 42,
  ): Omit<TimelineEvent, 'id'> {
    const rng = createSeededRng(seed);
    const delayMinutes = persona.responseDelayMinutes.min +
      Math.floor(rng() * (persona.responseDelayMinutes.max - persona.responseDelayMinutes.min) * 0.5);
    const responseTime = new Date(promptDate.getTime() + delayMinutes * 60 * 1000);

    // Most personas confirm their own initiated requests
    const willConfirm = rng() < (persona.cooperativeness + 0.3);
    const messageBody = willConfirm ? 'yes' : 'no';

    return this.createEvent(
      TimelineEventType.INBOUND_MESSAGE,
      responseTime,
      persona,
      familyId,
      { phoneNumber: persona.phoneNumber, messageBody },
    );
  }

  // ── Private Helpers ──────────────────────────────────────

  private createEvent(
    type: TimelineEventType,
    scheduledAt: Date,
    persona: PersonaProfile,
    familyId: string,
    payload: Record<string, unknown>,
  ): Omit<TimelineEvent, 'id'> {
    return {
      type,
      scheduledAt,
      actorId: persona.id,
      familyId,
      payload,
    };
  }

  private scheduledTime(date: Date, hour: number): Date {
    const d = new Date(date);
    d.setHours(Math.min(hour, 23), Math.floor(Math.random() * 60), 0, 0);
    return d;
  }

  private addDays(dateStr: string, days: number): string {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }

  private formatDateForSms(dateStr: string): string {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }
}

// ── Seeded RNG ─────────────────────────────────────────────

function createSeededRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (s >>> 0) / 0xFFFFFFFF;
  };
}
