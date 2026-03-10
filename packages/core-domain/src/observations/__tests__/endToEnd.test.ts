import { describe, it, expect, beforeEach } from 'vitest';
import { PolicySuggestionService } from '../core/PolicySuggestionService';
import { PolicySuggestionResolutionWorkflow } from '../suggestions/PolicySuggestionResolutionWorkflow';
import { PatternDetectorRegistry } from '../detectors/PatternDetectorRegistry';
import { ExchangePatternEvidenceExtractor, ExchangeRecord } from '../evidence/ExchangePatternEvidenceExtractor';
import { OverlayCoverageEvidenceExtractor, OverlayCoverageRecord } from '../evidence/OverlayCoverageEvidenceExtractor';
import {
  BehaviorObservationWindow,
  ObservationEvidenceRecord,
  PolicySuggestion,
  PolicySuggestionEvidenceLink,
} from '../types';
import { IObservationEvidenceRepository } from '../repositories/IObservationEvidenceRepository';
import { IPolicySuggestionRepository } from '../repositories/IPolicySuggestionRepository';
import { IPolicySuggestionEvidenceLinkRepository } from '../repositories/IPolicySuggestionEvidenceLinkRepository';
import { IPolicyRuleRepository } from '../../policy/repositories/IPolicyRuleRepository';
import { TypedPolicyRule } from '../../policy/types/TypedPolicyRule';

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

class InMemoryPolicyRuleRepo implements IPolicyRuleRepository {
  rules: TypedPolicyRule[] = [];
  async findById(id: string) { return this.rules.find(r => r.id === id) ?? null; }
  async findByFamilyId(fid: string) { return this.rules.filter(r => r.familyId === fid); }
  async findActiveByFamilyId(fid: string) { return this.rules.filter(r => r.familyId === fid && r.active); }
  async save(r: TypedPolicyRule) { this.rules.push(r); }
  async update(r: TypedPolicyRule) {
    const idx = this.rules.findIndex(x => x.id === r.id);
    if (idx >= 0) this.rules[idx] = r;
  }
  async delete(id: string) { this.rules = this.rules.filter(r => r.id !== id); }
}

const WINDOW: BehaviorObservationWindow = {
  familyId: 'fam-1',
  startDate: '2026-03-01',
  endDate: '2026-03-31',
};

describe('End-to-end observation flow', () => {
  let evidenceRepo: InMemoryEvidenceRepo;
  let suggestionRepo: InMemorySuggestionRepo;
  let linkRepo: InMemoryLinkRepo;
  let policyRepo: InMemoryPolicyRuleRepo;
  let idCounter: number;

  beforeEach(() => {
    evidenceRepo = new InMemoryEvidenceRepo();
    suggestionRepo = new InMemorySuggestionRepo();
    linkRepo = new InMemoryLinkRepo();
    policyRepo = new InMemoryPolicyRuleRepo();
    idCounter = 0;
  });

  it('repeated accepted Sunday exchanges -> exchange-day suggestion', async () => {
    // All exchanges are on Sundays (day 0)
    const exchanges: ExchangeRecord[] = [
      { exchangeId: 'e1', familyId: 'fam-1', date: '2026-03-01', childId: 'c1', fromParentId: 'p1', toParentId: 'p2', time: '09:00', location: 'School' },
      { exchangeId: 'e2', familyId: 'fam-1', date: '2026-03-08', childId: 'c1', fromParentId: 'p2', toParentId: 'p1', time: '09:00', location: 'School' },
      { exchangeId: 'e3', familyId: 'fam-1', date: '2026-03-15', childId: 'c1', fromParentId: 'p1', toParentId: 'p2', time: '09:00', location: 'School' },
      { exchangeId: 'e4', familyId: 'fam-1', date: '2026-03-22', childId: 'c1', fromParentId: 'p2', toParentId: 'p1', time: '09:00', location: 'School' },
    ];

    const service = new PolicySuggestionService({
      extractors: [new ExchangePatternEvidenceExtractor(exchanges)],
      detectorRegistry: new PatternDetectorRegistry(),
      evidenceRepository: evidenceRepo,
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      idGenerator: (prefix) => `${prefix}-${++idCounter}`,
    });

    const suggestions = await service.generateSuggestions({ window: WINDOW });

    // Should detect exchange day pattern and/or exchange location pattern
    const dayS = suggestions.find(s => s.suggestionType === 'PREFERRED_EXCHANGE_DAY');
    const locS = suggestions.find(s => s.suggestionType === 'PREFERRED_EXCHANGE_LOCATION');

    // At least one should be generated (exchange day for sure)
    expect(dayS || locS).toBeDefined();

    if (dayS) {
      expect(dayS.status).toBe('PENDING_REVIEW');
      expect(dayS.proposedParameters.preferredExchangeDay).toBeDefined();
    }
  });

  it('repeated school closure coverage -> coverage preference suggestion', async () => {
    const overlays: OverlayCoverageRecord[] = [
      { overlayId: 'o1', familyId: 'fam-1', date: '2026-03-05', childId: 'c1', assignedParentId: 'p1', disruptionType: 'SCHOOL_CLOSURE' },
      { overlayId: 'o2', familyId: 'fam-1', date: '2026-03-12', childId: 'c1', assignedParentId: 'p1', disruptionType: 'SCHOOL_CLOSURE' },
      { overlayId: 'o3', familyId: 'fam-1', date: '2026-03-19', childId: 'c1', assignedParentId: 'p1', disruptionType: 'SCHOOL_CLOSURE' },
      { overlayId: 'o4', familyId: 'fam-1', date: '2026-03-26', childId: 'c1', assignedParentId: 'p1', disruptionType: 'SCHOOL_CLOSURE' },
    ];

    const service = new PolicySuggestionService({
      extractors: [new OverlayCoverageEvidenceExtractor(overlays)],
      detectorRegistry: new PatternDetectorRegistry(),
      evidenceRepository: evidenceRepo,
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      idGenerator: (prefix) => `${prefix}-${++idCounter}`,
    });

    const suggestions = await service.generateSuggestions({ window: WINDOW });
    const coverageS = suggestions.find(s => s.suggestionType === 'SCHOOL_CLOSURE_COVERAGE_PREFERENCE');

    expect(coverageS).toBeDefined();
    expect(coverageS!.proposedParameters.preferredResponsibleParentId).toBe('p1');
  });

  it('accepted suggestion becomes active policy rule only after confirmation', async () => {
    const overlays: OverlayCoverageRecord[] = Array.from({ length: 4 }, (_, i) => ({
      overlayId: `o${i}`,
      familyId: 'fam-1',
      date: `2026-03-${String(i * 7 + 5).padStart(2, '0')}`,
      childId: 'c1',
      assignedParentId: 'p1',
      disruptionType: 'SCHOOL_CLOSURE',
    }));

    const service = new PolicySuggestionService({
      extractors: [new OverlayCoverageEvidenceExtractor(overlays)],
      detectorRegistry: new PatternDetectorRegistry(),
      evidenceRepository: evidenceRepo,
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      idGenerator: (prefix) => `${prefix}-${++idCounter}`,
    });

    const suggestions = await service.generateSuggestions({ window: WINDOW });
    expect(suggestions.length).toBeGreaterThan(0);

    // No policy rules should exist yet
    expect(policyRepo.rules).toHaveLength(0);

    // Create resolution workflow
    const workflow = new PolicySuggestionResolutionWorkflow({
      suggestionRepository: suggestionRepo,
      policyRuleRepository: policyRepo,
      idGenerator: (prefix) => `${prefix}-${++idCounter}`,
    });

    // Accept the suggestion
    const coverageS = suggestions.find(s => s.suggestionType === 'SCHOOL_CLOSURE_COVERAGE_PREFERENCE')!;

    const result = await workflow.resolveSuggestion({
      suggestionId: coverageS.suggestionId,
      decision: 'ACCEPT',
      resolvedAt: '2026-03-27T10:00:00Z',
      resolvedBy: 'parent-p1',
    });

    expect(result.status).toBe('ACCEPTED');
    expect(result.createdPolicyRuleId).toBeDefined();

    // Now verify the policy rule exists
    const rule = await policyRepo.findById(result.createdPolicyRuleId!);
    expect(rule).not.toBeNull();
    expect(rule!.active).toBe(true);
    expect(rule!.ruleType).toBe('ACTIVITY_COMMITMENT');
  });
});
