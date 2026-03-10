/**
 * Persona Types — behavior models for simulated co-parents.
 *
 * Personas are deterministic behavior profiles that define how a simulated
 * parent responds to events and initiates actions. They produce SMS messages
 * that feed through the real ConversationOrchestrator, exactly like live traffic.
 *
 * No LLM — all behavior is rule-based and seeded for reproducibility.
 */

export interface PersonaProfile {
  id: string;
  name: string;
  description: string;
  role: 'parent_a' | 'parent_b';
  phoneNumber: string;

  // Behavior dimensions (0.0–1.0)
  responsiveness: number;       // How quickly they respond to proposals
  cooperativeness: number;      // Likelihood of accepting proposals
  initiationRate: number;       // How often they initiate swap/coverage requests
  disruptionFrequency: number;  // How often they report disruptions (illness, travel, etc.)
  communicationStyle: 'terse' | 'normal' | 'verbose';

  // Decision patterns
  preferredDays: number[];        // JS DOW (0=Sun..6=Sat) they prefer for custody
  avoidDays: number[];            // Days they tend to request coverage for
  acceptThreshold: number;        // Accept proposals with penalty score below this
  optionPreference: 'first' | 'best_fairness' | 'least_change';

  // Timing
  responseDelayMinutes: { min: number; max: number };
  activeHours: { start: number; end: number };
}

export interface PersonaAction {
  type: PersonaActionType;
  scheduledAt: Date;
  messageBody: string;
  phoneNumber: string;
  actorId: string;
  familyId: string;
  metadata?: Record<string, unknown>;
}

export enum PersonaActionType {
  INITIATE_SWAP = 'INITIATE_SWAP',
  INITIATE_COVERAGE = 'INITIATE_COVERAGE',
  INITIATE_EXTRA_TIME = 'INITIATE_EXTRA_TIME',
  REPORT_DISRUPTION = 'REPORT_DISRUPTION',
  ACCEPT_PROPOSAL = 'ACCEPT_PROPOSAL',
  DECLINE_PROPOSAL = 'DECLINE_PROPOSAL',
  CHECK_STATUS = 'CHECK_STATUS',
  RESPOND_YES = 'RESPOND_YES',
  RESPOND_NO = 'RESPOND_NO',
  PROVIDE_DATES = 'PROVIDE_DATES',
}
