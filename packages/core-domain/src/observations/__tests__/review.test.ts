import { describe, it, expect, beforeEach } from 'vitest';
import { PolicySuggestionReviewService } from '../review/PolicySuggestionReviewService';
import { PolicySuggestionArtifactBuilder } from '../review/PolicySuggestionArtifactBuilder';
import {
  PolicySuggestion,
  ObservationEvidenceRecord,
  PolicySuggestionEvidenceLink,
  BehaviorObservationWindow,
} from '../types';
import { IObservationEvidenceRepository } from '../repositories/IObservationEvidenceRepository';
import { IPolicySuggestionRepository } from '../repositories/IPolicySuggestionRepository';
import { IPolicySuggestionEvidenceLinkRepository } from '../repositories/IPolicySuggestionEvidenceLinkRepository';

// ─── In-memory repositories ─────────────────────────────────

class InMemoryEvidenceRepo implements IObservationEvidenceRepository {
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

class InMemorySuggestionRepo implements IPolicySuggestionRepository {
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

class InMemoryLinkRepo implements IPolicySuggestionEvidenceLinkRepository {
  links: PolicySuggestionEvidenceLink[] = [];
  async save(l: PolicySuggestionEvidenceLink) { this.links.push(l); }
  async saveBatch(ls: PolicySuggestionEvidenceLink[]) { this.links.push(...ls); }
  async findBySuggestionId(sid: string) { return this.links.filter(l => l.suggestionId === sid); }
  async findByEvidenceId(eid: string) { return this.links.filter(l => l.evidenceId === eid); }
}

// ─── Test fixtures ───────────────────────────────────────────

const testSuggestion: PolicySuggestion = {
  suggestionId: 'sug-1',
  familyId: 'fam-1',
  suggestionType: 'PREFERRED_EXCHANGE_DAY',
  status: 'PENDING_REVIEW',
  confidenceScore: 0.8,
  evidenceSummary: {
    occurrenceCount: 4,
    windowStart: '2026-03-01',
    windowEnd: '2026-03-31',
    representativeExamples: [
      { date: '2026-03-01', data: { dayOfWeek: 0 } },
      { date: '2026-03-08', data: { dayOfWeek: 0 } },
    ],
  },
  proposedRuleType: 'EXCHANGE_LOCATION',
  proposedPriority: 'SOFT',
  proposedParameters: { preferredExchangeDay: 0 },
  proposedScope: { scopeType: 'FAMILY' },
  createdAt: '2026-03-25T10:00:00Z',
};

const testEvidence: ObservationEvidenceRecord[] = [
  { evidenceId: 'ev-1', familyId: 'fam-1', evidenceType: 'EXCHANGE_PATTERN', date: '2026-03-01', data: { dayOfWeek: 0 }, createdAt: '2026-03-01T00:00:00Z' },
  { evidenceId: 'ev-2', familyId: 'fam-1', evidenceType: 'EXCHANGE_PATTERN', date: '2026-03-08', data: { dayOfWeek: 0 }, createdAt: '2026-03-08T00:00:00Z' },
  { evidenceId: 'ev-3', familyId: 'fam-1', evidenceType: 'EXCHANGE_PATTERN', date: '2026-03-15', data: { dayOfWeek: 0 }, createdAt: '2026-03-15T00:00:00Z' },
];

const testLinks: PolicySuggestionEvidenceLink[] = [
  { id: 'link-1', suggestionId: 'sug-1', evidenceId: 'ev-1', createdAt: '2026-03-25T10:00:00Z' },
  { id: 'link-2', suggestionId: 'sug-1', evidenceId: 'ev-2', createdAt: '2026-03-25T10:00:00Z' },
  { id: 'link-3', suggestionId: 'sug-1', evidenceId: 'ev-3', createdAt: '2026-03-25T10:00:00Z' },
];

describe('PolicySuggestionReviewService', () => {
  let evidenceRepo: InMemoryEvidenceRepo;
  let suggestionRepo: InMemorySuggestionRepo;
  let linkRepo: InMemoryLinkRepo;
  let service: PolicySuggestionReviewService;

  beforeEach(() => {
    evidenceRepo = new InMemoryEvidenceRepo();
    suggestionRepo = new InMemorySuggestionRepo();
    linkRepo = new InMemoryLinkRepo();
    evidenceRepo.records = [...testEvidence];
    suggestionRepo.suggestions = [{ ...testSuggestion }];
    linkRepo.links = [...testLinks];
    service = new PolicySuggestionReviewService({
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      evidenceRepository: evidenceRepo,
    });
  });

  it('builds review bundle with evidence summary', async () => {
    const bundle = await service.getReviewBundle('sug-1');
    expect(bundle.suggestionId).toBe('sug-1');
    expect(bundle.suggestionType).toBe('PREFERRED_EXCHANGE_DAY');
    expect(bundle.confidenceScore).toBe(0.8);
    expect(bundle.evidenceSummary.occurrenceCount).toBe(4);
    expect(bundle.artifacts.length).toBeGreaterThan(0);
  });

  it('includes representative examples deterministically', async () => {
    const b1 = await service.getReviewBundle('sug-1');
    const b2 = await service.getReviewBundle('sug-1');
    expect(b1.evidenceSummary.representativeExamples)
      .toEqual(b2.evidenceSummary.representativeExamples);
    expect(b1.artifacts).toEqual(b2.artifacts);
  });

  it('includes correct artifact types', async () => {
    const bundle = await service.getReviewBundle('sug-1');
    const types = bundle.artifacts.map(a => a.type);
    expect(types).toContain('EVIDENCE_COUNT_SUMMARY');
    expect(types).toContain('REPRESENTATIVE_EXAMPLES');
    expect(types).toContain('CONFIDENCE_INPUTS');
    expect(types).toContain('PROPOSED_RULE');
  });

  it('returns pending bundles in deterministic order', async () => {
    // Add another suggestion with lower confidence
    suggestionRepo.suggestions.push({
      ...testSuggestion,
      suggestionId: 'sug-2',
      confidenceScore: 0.7,
      suggestionType: 'PREFERRED_EXCHANGE_LOCATION',
    });

    const bundles = await service.getPendingReviewBundles('fam-1');
    expect(bundles).toHaveLength(2);
    expect(bundles[0].confidenceScore).toBeGreaterThanOrEqual(bundles[1].confidenceScore);
  });

  it('throws on non-existent suggestion', async () => {
    await expect(service.getReviewBundle('nonexistent')).rejects.toThrow('Suggestion not found');
  });
});

describe('PolicySuggestionArtifactBuilder', () => {
  const builder = new PolicySuggestionArtifactBuilder();

  it('builds 4 artifact types', () => {
    const artifacts = builder.buildArtifacts({
      suggestion: testSuggestion,
      linkedEvidence: testEvidence,
    });
    expect(artifacts).toHaveLength(4);
  });
});
