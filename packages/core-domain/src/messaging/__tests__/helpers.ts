import { vi } from 'vitest';
import {
  IncomingMessage,
  ExtractionFamilyContext,
  InterpretedIntent,
  IntentType,
  IntentRecord,
} from '../types';
import { IIntentRepository } from '../repositories/IIntentRepository';

export const FAMILY_ID = 'family-1';
export const PARENT_A_ID = 'parent-a';
export const PARENT_B_ID = 'parent-b';
export const CHILD_1_ID = 'child-1';
export const CHILD_2_ID = 'child-2';

export function makeMessage(overrides?: Partial<IncomingMessage>): IncomingMessage {
  return {
    messageId: 'msg-1',
    familyId: FAMILY_ID,
    senderParentId: PARENT_A_ID,
    text: 'I need to swap Thursday',
    receivedAt: '2026-03-09T10:00:00Z',
    channel: 'sms',
    ...overrides,
  };
}

export function makeFamilyContext(overrides?: Partial<ExtractionFamilyContext>): ExtractionFamilyContext {
  return {
    familyId: FAMILY_ID,
    parents: [
      { id: PARENT_A_ID, name: 'Alice', role: 'MOTHER' },
      { id: PARENT_B_ID, name: 'Bob', role: 'FATHER' },
    ],
    children: [
      { id: CHILD_1_ID, name: 'Charlie', birthDate: '2020-01-15' },
      { id: CHILD_2_ID, name: 'Dana', birthDate: '2022-06-20' },
    ],
    activePolicySuggestions: [
      { id: 'policy-1', label: 'Minimum 2-night blocks' },
    ],
    timezone: 'America/New_York',
    ...overrides,
  };
}

export function makeInterpretedIntent(overrides?: Partial<InterpretedIntent>): InterpretedIntent {
  return {
    intentId: 'intent-1',
    familyId: FAMILY_ID,
    parentId: PARENT_A_ID,
    type: IntentType.SWAP_REQUEST,
    payload: { targetDate: '2026-03-15', reason: 'schedule conflict' },
    confidence: 0.9,
    resolvedEntities: {},
    createdAt: '2026-03-09T10:00:00Z',
    ...overrides,
  };
}

export function makeMockIntentRepo(): IIntentRepository & {
  records: IntentRecord[];
} {
  const records: IntentRecord[] = [];
  return {
    records,
    create: vi.fn(async (record: IntentRecord) => {
      records.push(record);
      return record;
    }),
    findById: vi.fn(async (id: string) =>
      records.find(r => r.id === id) ?? null,
    ),
    findByFamilyId: vi.fn(async (familyId: string) =>
      records.filter(r => r.familyId === familyId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)),
    ),
    findByMessageId: vi.fn(async (messageId: string) =>
      records.filter(r => r.messageId === messageId),
    ),
    findByParentId: vi.fn(async (parentId: string) =>
      records.filter(r => r.parentId === parentId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)),
    ),
  };
}
