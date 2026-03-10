import {
  ObservationEvidenceRecord,
  PolicySuggestion,
  PolicySuggestionEvidenceLink,
  BehaviorObservationWindow,
} from '../types';
import { IObservationEvidenceRepository } from '../repositories/IObservationEvidenceRepository';
import { IPolicySuggestionRepository } from '../repositories/IPolicySuggestionRepository';
import { IPolicySuggestionEvidenceLinkRepository } from '../repositories/IPolicySuggestionEvidenceLinkRepository';
import { IPolicyRuleRepository } from '../../policy/repositories/IPolicyRuleRepository';
import { TypedPolicyRule } from '../../policy/types/TypedPolicyRule';

// ─── In-memory repositories ─────────────────────────────────

export class InMemoryEvidenceRepo implements IObservationEvidenceRepository {
  records: ObservationEvidenceRecord[] = [];
  async save(r: ObservationEvidenceRecord) { this.records.push(r); }
  async saveBatch(rs: ObservationEvidenceRecord[]) { this.records.push(...rs); }
  async findByFamilyId(fid: string) { return this.records.filter(r => r.familyId === fid); }
  async findByWindow(w: BehaviorObservationWindow) {
    return this.records.filter(r => r.familyId === w.familyId && r.date >= w.startDate && r.date <= w.endDate);
  }
  async findById(id: string) { return this.records.find(r => r.evidenceId === id) ?? null; }
  async findByIds(ids: string[]) { return this.records.filter(r => ids.includes(r.evidenceId)); }
}

export class InMemorySuggestionRepo implements IPolicySuggestionRepository {
  suggestions: PolicySuggestion[] = [];
  async save(s: PolicySuggestion) { this.suggestions.push(s); }
  async findById(id: string) { return this.suggestions.find(s => s.suggestionId === id) ?? null; }
  async findByFamilyId(fid: string) { return this.suggestions.filter(s => s.familyId === fid); }
  async findPendingByFamilyId(fid: string) {
    return this.suggestions.filter(s => s.familyId === fid && s.status === 'PENDING_REVIEW');
  }
  async update(s: PolicySuggestion) {
    const idx = this.suggestions.findIndex(x => x.suggestionId === s.suggestionId);
    if (idx >= 0) this.suggestions[idx] = s;
  }
}

export class InMemoryLinkRepo implements IPolicySuggestionEvidenceLinkRepository {
  links: PolicySuggestionEvidenceLink[] = [];
  async save(l: PolicySuggestionEvidenceLink) { this.links.push(l); }
  async saveBatch(ls: PolicySuggestionEvidenceLink[]) { this.links.push(...ls); }
  async findBySuggestionId(sid: string) { return this.links.filter(l => l.suggestionId === sid); }
  async findByEvidenceId(eid: string) { return this.links.filter(l => l.evidenceId === eid); }
}

export class InMemoryPolicyRuleRepo implements IPolicyRuleRepository {
  rules: TypedPolicyRule[] = [];
  async findById(id: string) { return this.rules.find(r => r.id === id) ?? null; }
  async findByFamilyId(fid: string) { return this.rules.filter(r => r.familyId === fid); }
  async findActiveByFamilyId(fid: string) { return this.rules.filter(r => r.familyId === fid && r.active); }
  async findBySourceSuggestionId(sid: string) { return this.rules.find(r => r.sourceSuggestionId === sid) ?? null; }
  async save(r: TypedPolicyRule) { this.rules.push(r); }
  async update(r: TypedPolicyRule) {
    const idx = this.rules.findIndex(x => x.id === r.id);
    if (idx >= 0) this.rules[idx] = r;
  }
  async delete(id: string) { this.rules = this.rules.filter(r => r.id !== id); }
}

// ─── Fixture factories ──────────────────────────────────────

export function makePendingSuggestion(overrides?: Partial<PolicySuggestion>): PolicySuggestion {
  return {
    suggestionId: 'sug-1',
    familyId: 'fam-1',
    suggestionType: 'MIN_BLOCK_LENGTH_ADJUSTMENT',
    status: 'PENDING_REVIEW',
    confidenceScore: 0.85,
    evidenceSummary: {
      occurrenceCount: 4,
      windowStart: '2026-03-01',
      windowEnd: '2026-03-31',
      representativeExamples: [],
    },
    proposedRuleType: 'MIN_BLOCK_LENGTH',
    proposedPriority: 'SOFT',
    proposedParameters: { nights: 3 },
    proposedScope: { scopeType: 'FAMILY' },
    createdAt: '2026-03-25T10:00:00Z',
    ...overrides,
  };
}

export function makeIdGenerator(): { gen: (prefix: string) => string; reset: () => void } {
  let counter = 0;
  return {
    gen: (prefix: string) => `${prefix}-${++counter}`,
    reset: () => { counter = 0; },
  };
}
