import { z } from 'zod';

// ─── Categories ────────────────────────────────────────────────

export const CATEGORIES = {
  ONBOARDING: 'Onboarding & Setup',
  ROUTINE: 'Routine Schedule Operations',
  EXCEPTIONS: 'Exception Requests',
  EMERGENCIES: 'Emergencies & Disruptions',
  HOLIDAYS: 'Holidays & Breaks',
  ACTIVITIES: 'Activities & Child Schedule',
  FAIRNESS: 'Fairness & Stability',
  COMPLIANCE: 'Compliance & Agreement',
  BILLING: 'Billing & Account',
  ADMIN: 'Admin & Preferences',
} as const;

export type Category = (typeof CATEGORIES)[keyof typeof CATEGORIES];

// ─── Chat Message Payload Contract ─────────────────────────────

export const ChatActionSchema = z.object({
  actionId: z.string(),
  label: z.string(),
  style: z.enum(['primary', 'secondary', 'danger']),
  payload: z.any(),
});

export const ChatMessageSchema = z.object({
  messageId: z.string(),
  scenarioNumber: z.number().int().min(1),
  createdAt: z.string(),
  to: z.object({ parentIds: z.array(z.string()).min(1) }),
  urgency: z.enum(['low', 'normal', 'high']),
  expiresAt: z.string().optional(),
  text: z.string().min(1),
  sections: z.array(z.object({
    title: z.string().optional(),
    bullets: z.array(z.string()).optional(),
  })).optional(),
  actions: z.array(ChatActionSchema).min(1),
  metadata: z.object({
    requiresBothParents: z.boolean().optional(),
    relatesToDateRange: z.object({
      start: z.string(),
      end: z.string(),
    }).optional(),
    scheduleDeltaPreview: z.any().optional(),
  }).optional(),
});

export type ChatAction = z.infer<typeof ChatActionSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

// ─── App State Model ───────────────────────────────────────────

export interface Parent {
  id: string;
  name: string;
  joined: boolean;
  preferences: {
    exchangeLocation: string;
    notificationMuted: boolean;
    mutedUntil?: string;
  };
  constraints: {
    lockedNights: number[];
    maxConsecutive: number;
    workShifts: { day: number; start: string; end: string }[];
    noInPersonExchange: boolean;
  };
}

export interface Child {
  id: string;
  name: string;
  ageBand: 'infant' | 'toddler' | 'preschool' | 'school-age' | 'teen';
  schoolDays: number[];
  schoolStart: string;
  schoolEnd: string;
}

export interface ScheduleAssignment {
  date: string;
  assignedTo: string;
  isTransition: boolean;
}

export interface Proposal {
  id: string;
  requestedBy: string;
  type: 'swap' | 'coverage' | 'vacation' | 'activity';
  dates: string[];
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'counter';
  counterOptions?: { id: string; label: string; dates: string[] }[];
  expiresAt?: string;
}

export interface FairnessLedger {
  parentAOvernights: number;
  parentBOvernights: number;
  parentAWeekends: number;
  parentBWeekends: number;
  transitionsThisWeek: number;
  maxConsecutiveA: number;
  maxConsecutiveB: number;
}

export interface Holiday {
  date: string;
  name: string;
  rule: 'rotate' | 'split' | 'attach-weekend' | 'unset';
  assignedTo?: string;
}

export interface RecurringActivity {
  id: string;
  childId: string;
  name: string;
  dayOfWeek: number;
  time: string;
  transportParent?: string;
}

export interface AppState {
  parents: Parent[];
  children: Child[];
  baselineSchedule: ScheduleAssignment[];
  pendingProposals: Proposal[];
  ledger: FairnessLedger;
  holidays: Holiday[];
  activities: RecurringActivity[];
  activeEmergency?: {
    type: string;
    reportedBy: string;
    startedAt: string;
    expiresAt: string;
  };
  courtOrder?: {
    minimumNights: Record<string, number>;
    enforced: boolean;
  };
  preConsentRules: {
    id: string;
    ruleType: string;
    threshold: Record<string, unknown>;
  }[];
  subscriptions: {
    parentId: string;
    plan: string;
    status: 'active' | 'invited' | 'none';
  }[];
}

// ─── Scenario Definition ───────────────────────────────────────

export interface TriggerResult {
  state: AppState;
  outgoingMessages: ChatMessage[];
}

export interface ScenarioDefinition {
  number: number;
  key: string;
  title: string;
  category: Category;
  description: string;
  implemented: boolean;
  paramsSchema: z.ZodType<any>;
  seedStateBuilder: (params: any) => AppState;
  triggerEvent: (state: AppState, params: any) => TriggerResult;
  expectedStateTransitions?: Record<string, (state: AppState, payload: any) => AppState>;
  timeoutPolicy?: {
    durationMinutes: number;
    onTimeout: (state: AppState) => TriggerResult;
  };
}
