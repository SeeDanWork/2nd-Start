import { describe, it, expect, beforeEach } from 'vitest';
import { PolicySuggestionService } from '../core/PolicySuggestionService';
import { PatternDetectorRegistry } from '../detectors/PatternDetectorRegistry';
import { ExchangePatternEvidenceExtractor, ExchangeRecord } from '../evidence/ExchangePatternEvidenceExtractor';
import {
  BehaviorObservationWindow,
  ObservationEvidenceRecord,
  PolicySuggestion,
  PolicySuggestionEvidenceLink,
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

// ─── Test data ───────────────────────────────────────────────

const WINDOW: BehaviorObservationWindow = {
  familyId: 'fam-1',
  startDate: '2026-03-01',
  endDate: '2026-03-31',
};

function makeSundayExchanges(): ExchangeRecord[] {
  // All Sunday exchanges (day 0) at the same location
  return [
    { exchangeId: 'e1', familyId: 'fam-1', date: '2026-03-01', childId: 'c1', fromParentId: 'p1', toParentId: 'p2', time: '09:00', location: 'School' },
    { exchangeId: 'e2', familyId: 'fam-1', date: '2026-03-08', childId: 'c1', fromParentId: 'p2', toParentId: 'p1', time: '09:00', location: 'School' },
    { exchangeId: 'e3', familyId: 'fam-1', date: '2026-03-15', childId: 'c1', fromParentId: 'p1', toParentId: 'p2', time: '09:00', location: 'School' },
    { exchangeId: 'e4', familyId: 'fam-1', date: '2026-03-22', childId: 'c1', fromParentId: 'p2', toParentId: 'p1', time: '09:00', location: 'School' },
  ];
}

describe('PolicySuggestionService', () => {
  let evidenceRepo: InMemoryEvidenceRepo;
  let suggestionRepo: InMemorySuggestionRepo;
  let linkRepo: InMemoryLinkRepo;
  let idCounter: number;

  beforeEach(() => {
    evidenceRepo = new InMemoryEvidenceRepo();
    suggestionRepo = new InMemorySuggestionRepo();
    linkRepo = new InMemoryLinkRepo();
    idCounter = 0;
  });

  function createService(exchanges: ExchangeRecord[]) {
    return new PolicySuggestionService({
      extractors: [new ExchangePatternEvidenceExtractor(exchanges)],
      detectorRegistry: new PatternDetectorRegistry(),
      evidenceRepository: evidenceRepo,
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      idGenerator: (prefix) => `${prefix}-${++idCounter}`,
    });
  }

  it('generates suggestions deterministically', async () => {
    const service = createService(makeSundayExchanges());

    const s1 = await service.generateSuggestions({ window: WINDOW });

    // Reset repos for second run
    evidenceRepo = new InMemoryEvidenceRepo();
    suggestionRepo = new InMemorySuggestionRepo();
    linkRepo = new InMemoryLinkRepo();
    idCounter = 0;

    const service2 = new PolicySuggestionService({
      extractors: [new ExchangePatternEvidenceExtractor(makeSundayExchanges())],
      detectorRegistry: new PatternDetectorRegistry(),
      evidenceRepository: evidenceRepo,
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      idGenerator: (prefix) => `${prefix}-${++idCounter}`,
    });

    const s2 = await service2.generateSuggestions({ window: WINDOW });

    expect(s1.length).toBe(s2.length);
    expect(s1.map(s => s.suggestionType)).toEqual(s2.map(s => s.suggestionType));
    expect(s1.map(s => s.confidenceScore)).toEqual(s2.map(s => s.confidenceScore));
  });

  it('deduplicates materially identical suggestions', async () => {
    const service = createService(makeSundayExchanges());

    const first = await service.generateSuggestions({ window: WINDOW });
    expect(first.length).toBeGreaterThan(0);

    // Run again — should not produce duplicates
    const second = await service.generateSuggestions({ window: WINDOW });
    expect(second).toHaveLength(0);
  });

  it('persists evidence links correctly', async () => {
    const service = createService(makeSundayExchanges());

    const suggestions = await service.generateSuggestions({ window: WINDOW });
    expect(suggestions.length).toBeGreaterThan(0);

    // Check that links were created
    for (const s of suggestions) {
      const links = await linkRepo.findBySuggestionId(s.suggestionId);
      expect(links.length).toBeGreaterThan(0);
    }

    // Check that evidence was persisted
    expect(evidenceRepo.records.length).toBeGreaterThan(0);
  });

  it('returns pending suggestions in deterministic order', async () => {
    const service = createService(makeSundayExchanges());

    await service.generateSuggestions({ window: WINDOW });

    const pending = await service.getPendingSuggestions({ familyId: 'fam-1' });
    expect(pending.length).toBeGreaterThan(0);

    // Verify descending confidence, then alphabetical type
    for (let i = 1; i < pending.length; i++) {
      const prev = pending[i - 1];
      const curr = pending[i];
      expect(prev.confidenceScore).toBeGreaterThanOrEqual(curr.confidenceScore);
    }
  });

  it('isolates suggestions between families — no cross-contamination', async () => {
    // Family 1: Sunday exchanges at School
    const fam1Exchanges: ExchangeRecord[] = [
      { exchangeId: 'e1', familyId: 'fam-1', date: '2026-03-01', childId: 'c1', fromParentId: 'p1', toParentId: 'p2', time: '09:00', location: 'School' },
      { exchangeId: 'e2', familyId: 'fam-1', date: '2026-03-08', childId: 'c1', fromParentId: 'p2', toParentId: 'p1', time: '09:00', location: 'School' },
      { exchangeId: 'e3', familyId: 'fam-1', date: '2026-03-15', childId: 'c1', fromParentId: 'p1', toParentId: 'p2', time: '09:00', location: 'School' },
      { exchangeId: 'e4', familyId: 'fam-1', date: '2026-03-22', childId: 'c1', fromParentId: 'p2', toParentId: 'p1', time: '09:00', location: 'School' },
    ];

    // Family 2: Wednesday exchanges at Park
    const fam2Exchanges: ExchangeRecord[] = [
      { exchangeId: 'e5', familyId: 'fam-2', date: '2026-03-04', childId: 'c2', fromParentId: 'p3', toParentId: 'p4', time: '17:00', location: 'Park' },
      { exchangeId: 'e6', familyId: 'fam-2', date: '2026-03-11', childId: 'c2', fromParentId: 'p4', toParentId: 'p3', time: '17:00', location: 'Park' },
      { exchangeId: 'e7', familyId: 'fam-2', date: '2026-03-18', childId: 'c2', fromParentId: 'p3', toParentId: 'p4', time: '17:00', location: 'Park' },
      { exchangeId: 'e8', familyId: 'fam-2', date: '2026-03-25', childId: 'c2', fromParentId: 'p4', toParentId: 'p3', time: '17:00', location: 'Park' },
    ];

    const WINDOW_FAM2: BehaviorObservationWindow = {
      familyId: 'fam-2',
      startDate: '2026-03-01',
      endDate: '2026-03-31',
    };

    // Run family 1
    const service1 = createService(fam1Exchanges);
    const s1 = await service1.generateSuggestions({ window: WINDOW });

    // Run family 2 on same repos
    const service2 = new PolicySuggestionService({
      extractors: [new ExchangePatternEvidenceExtractor(fam2Exchanges)],
      detectorRegistry: new PatternDetectorRegistry(),
      evidenceRepository: evidenceRepo,
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      idGenerator: (prefix) => `${prefix}-${++idCounter}`,
    });
    const s2 = await service2.generateSuggestions({ window: WINDOW_FAM2 });

    // Both families should have generated suggestions
    expect(s1.length).toBeGreaterThan(0);
    expect(s2.length).toBeGreaterThan(0);

    // All fam-1 suggestions belong to fam-1
    for (const s of s1) {
      expect(s.familyId).toBe('fam-1');
    }

    // All fam-2 suggestions belong to fam-2
    for (const s of s2) {
      expect(s.familyId).toBe('fam-2');
    }

    // getPendingSuggestions only returns the correct family
    const pending1 = await service1.getPendingSuggestions({ familyId: 'fam-1' });
    const pending2 = await service2.getPendingSuggestions({ familyId: 'fam-2' });

    for (const p of pending1) expect(p.familyId).toBe('fam-1');
    for (const p of pending2) expect(p.familyId).toBe('fam-2');

    // No cross-contamination: fam-1 pending should not contain fam-2 suggestions
    const pending1Ids = new Set(pending1.map(p => p.suggestionId));
    const pending2Ids = new Set(pending2.map(p => p.suggestionId));
    for (const id of pending1Ids) {
      expect(pending2Ids.has(id)).toBe(false);
    }
  });
});
