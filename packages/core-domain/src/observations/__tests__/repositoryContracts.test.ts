import { describe, it, expect, beforeEach } from 'vitest';
import { PolicySuggestionService } from '../core/PolicySuggestionService';
import { PolicySuggestionResolutionWorkflow } from '../suggestions/PolicySuggestionResolutionWorkflow';
import { PolicySuggestionReviewService } from '../review/PolicySuggestionReviewService';
import { PatternDetectorRegistry } from '../detectors/PatternDetectorRegistry';
import { OverlayCoverageEvidenceExtractor, OverlayCoverageRecord } from '../evidence/OverlayCoverageEvidenceExtractor';
import {
  ObservationEvidenceRecord,
  PolicySuggestion,
  PolicySuggestionEvidenceLink,
  BehaviorObservationWindow,
} from '../types';
import {
  InMemoryEvidenceRepo,
  InMemorySuggestionRepo,
  InMemoryLinkRepo,
  InMemoryPolicyRuleRepo,
  makePendingSuggestion,
  makeIdGenerator,
} from './helpers';

// ═══════════════════════════════════════════════════════════════
// A. Evidence repository contract
// ═══════════════════════════════════════════════════════════════

describe('Evidence repository contract', () => {
  let repo: InMemoryEvidenceRepo;

  beforeEach(() => {
    repo = new InMemoryEvidenceRepo();
  });

  const makeRecord = (id: string, familyId: string, date: string): ObservationEvidenceRecord => ({
    evidenceId: id,
    familyId,
    evidenceType: 'EXCHANGE_PATTERN',
    date,
    data: { dayOfWeek: 0 },
    createdAt: `${date}T00:00:00Z`,
  });

  it('save stores a record retrievable by findById', async () => {
    const r = makeRecord('ev-1', 'fam-1', '2026-03-05');
    await repo.save(r);

    const found = await repo.findById('ev-1');
    expect(found).not.toBeNull();
    expect(found!.evidenceId).toBe('ev-1');
    expect(found!.familyId).toBe('fam-1');
    expect(found!.date).toBe('2026-03-05');
    expect(found!.data).toEqual({ dayOfWeek: 0 });
  });

  it('findById returns null for nonexistent record', async () => {
    const found = await repo.findById('nonexistent');
    expect(found).toBeNull();
  });

  it('saveBatch stores multiple records correctly', async () => {
    const records = [
      makeRecord('ev-1', 'fam-1', '2026-03-05'),
      makeRecord('ev-2', 'fam-1', '2026-03-12'),
      makeRecord('ev-3', 'fam-1', '2026-03-19'),
    ];
    await repo.saveBatch(records);

    expect(repo.records).toHaveLength(3);
    expect(await repo.findById('ev-1')).not.toBeNull();
    expect(await repo.findById('ev-2')).not.toBeNull();
    expect(await repo.findById('ev-3')).not.toBeNull();
  });

  it('findByIds returns matching records in insertion order', async () => {
    await repo.saveBatch([
      makeRecord('ev-3', 'fam-1', '2026-03-19'),
      makeRecord('ev-1', 'fam-1', '2026-03-05'),
      makeRecord('ev-2', 'fam-1', '2026-03-12'),
    ]);

    const found = await repo.findByIds(['ev-2', 'ev-3']);
    expect(found).toHaveLength(2);
    // In-memory implementation preserves insertion order, filtered by id inclusion
    expect(found[0].evidenceId).toBe('ev-3');
    expect(found[1].evidenceId).toBe('ev-2');
  });

  it('findByIds returns empty array for no matches', async () => {
    await repo.save(makeRecord('ev-1', 'fam-1', '2026-03-05'));
    const found = await repo.findByIds(['ev-99', 'ev-100']);
    expect(found).toEqual([]);
  });

  it('findByFamilyId returns only records for the requested family', async () => {
    await repo.saveBatch([
      makeRecord('ev-1', 'fam-1', '2026-03-05'),
      makeRecord('ev-2', 'fam-2', '2026-03-05'),
      makeRecord('ev-3', 'fam-1', '2026-03-12'),
    ]);

    const fam1 = await repo.findByFamilyId('fam-1');
    expect(fam1).toHaveLength(2);
    expect(fam1.every(r => r.familyId === 'fam-1')).toBe(true);

    const fam2 = await repo.findByFamilyId('fam-2');
    expect(fam2).toHaveLength(1);
    expect(fam2[0].evidenceId).toBe('ev-2');

    const fam3 = await repo.findByFamilyId('fam-3');
    expect(fam3).toEqual([]);
  });

  it('findByWindow returns only records inside the window', async () => {
    await repo.saveBatch([
      makeRecord('ev-before', 'fam-1', '2026-02-28'),
      makeRecord('ev-start', 'fam-1', '2026-03-01'),
      makeRecord('ev-mid', 'fam-1', '2026-03-15'),
      makeRecord('ev-end', 'fam-1', '2026-03-31'),
      makeRecord('ev-after', 'fam-1', '2026-04-01'),
    ]);

    const window: BehaviorObservationWindow = {
      familyId: 'fam-1',
      startDate: '2026-03-01',
      endDate: '2026-03-31',
    };

    const found = await repo.findByWindow(window);
    expect(found).toHaveLength(3);
    const ids = found.map(r => r.evidenceId);
    expect(ids).toContain('ev-start');
    expect(ids).toContain('ev-mid');
    expect(ids).toContain('ev-end');
    expect(ids).not.toContain('ev-before');
    expect(ids).not.toContain('ev-after');
  });

  it('findByWindow filters by familyId and date range together', async () => {
    await repo.saveBatch([
      makeRecord('ev-1', 'fam-1', '2026-03-10'),
      makeRecord('ev-2', 'fam-2', '2026-03-10'),
    ]);

    const window: BehaviorObservationWindow = {
      familyId: 'fam-1',
      startDate: '2026-03-01',
      endDate: '2026-03-31',
    };

    const found = await repo.findByWindow(window);
    expect(found).toHaveLength(1);
    expect(found[0].evidenceId).toBe('ev-1');
  });

  it('repeated save appends duplicate records (no dedup at repo level)', async () => {
    const r = makeRecord('ev-1', 'fam-1', '2026-03-05');
    await repo.save(r);
    await repo.save(r);

    expect(repo.records).toHaveLength(2);
    expect(repo.records[0].evidenceId).toBe('ev-1');
    expect(repo.records[1].evidenceId).toBe('ev-1');

    // findById returns the first match
    const found = await repo.findById('ev-1');
    expect(found).not.toBeNull();
  });

  it('repeated saveBatch appends all records each time', async () => {
    const batch = [makeRecord('ev-1', 'fam-1', '2026-03-05')];
    await repo.saveBatch(batch);
    await repo.saveBatch(batch);

    expect(repo.records).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════════════════
// B. Suggestion repository contract
// ═══════════════════════════════════════════════════════════════

describe('Suggestion repository contract', () => {
  let repo: InMemorySuggestionRepo;

  beforeEach(() => {
    repo = new InMemorySuggestionRepo();
  });

  it('save stores a suggestion retrievable by findById', async () => {
    const s = makePendingSuggestion({ suggestionId: 'sug-1' });
    await repo.save(s);

    const found = await repo.findById('sug-1');
    expect(found).not.toBeNull();
    expect(found!.suggestionId).toBe('sug-1');
    expect(found!.familyId).toBe('fam-1');
    expect(found!.status).toBe('PENDING_REVIEW');
    expect(found!.proposedParameters).toEqual({ nights: 3 });
  });

  it('findById returns null for nonexistent suggestion', async () => {
    expect(await repo.findById('nonexistent')).toBeNull();
  });

  it('findByFamilyId returns only that family suggestions', async () => {
    await repo.save(makePendingSuggestion({ suggestionId: 'sug-1', familyId: 'fam-1' }));
    await repo.save(makePendingSuggestion({ suggestionId: 'sug-2', familyId: 'fam-2' }));
    await repo.save(makePendingSuggestion({ suggestionId: 'sug-3', familyId: 'fam-1' }));

    const fam1 = await repo.findByFamilyId('fam-1');
    expect(fam1).toHaveLength(2);
    expect(fam1.every(s => s.familyId === 'fam-1')).toBe(true);

    const fam2 = await repo.findByFamilyId('fam-2');
    expect(fam2).toHaveLength(1);
    expect(fam2[0].suggestionId).toBe('sug-2');
  });

  it('findPendingByFamilyId returns only PENDING_REVIEW suggestions', async () => {
    await repo.save(makePendingSuggestion({ suggestionId: 'sug-pending', status: 'PENDING_REVIEW' }));
    await repo.save(makePendingSuggestion({ suggestionId: 'sug-accepted', status: 'ACCEPTED' }));
    await repo.save(makePendingSuggestion({ suggestionId: 'sug-rejected', status: 'REJECTED' }));
    await repo.save(makePendingSuggestion({ suggestionId: 'sug-expired', status: 'EXPIRED' }));

    const pending = await repo.findPendingByFamilyId('fam-1');
    expect(pending).toHaveLength(1);
    expect(pending[0].suggestionId).toBe('sug-pending');
  });

  it('update changes suggestion fields in place', async () => {
    await repo.save(makePendingSuggestion({ suggestionId: 'sug-1' }));

    const s = await repo.findById('sug-1');
    s!.status = 'ACCEPTED';
    s!.resolvedAt = '2026-03-28T10:00:00Z';
    s!.resolvedBy = 'parent-p1';
    await repo.update(s!);

    const updated = await repo.findById('sug-1');
    expect(updated!.status).toBe('ACCEPTED');
    expect(updated!.resolvedAt).toBe('2026-03-28T10:00:00Z');
    expect(updated!.resolvedBy).toBe('parent-p1');
  });

  it('accepted suggestion is excluded from findPendingByFamilyId', async () => {
    await repo.save(makePendingSuggestion({ suggestionId: 'sug-1' }));
    const s = await repo.findById('sug-1');
    s!.status = 'ACCEPTED';
    await repo.update(s!);

    const pending = await repo.findPendingByFamilyId('fam-1');
    expect(pending).toHaveLength(0);

    // But still queryable by findById and findByFamilyId
    expect(await repo.findById('sug-1')).not.toBeNull();
    const all = await repo.findByFamilyId('fam-1');
    expect(all).toHaveLength(1);
    expect(all[0].status).toBe('ACCEPTED');
  });

  it('rejected suggestion is excluded from findPendingByFamilyId but queryable', async () => {
    await repo.save(makePendingSuggestion({ suggestionId: 'sug-1' }));
    const s = await repo.findById('sug-1');
    s!.status = 'REJECTED';
    await repo.update(s!);

    const pending = await repo.findPendingByFamilyId('fam-1');
    expect(pending).toHaveLength(0);

    const found = await repo.findById('sug-1');
    expect(found!.status).toBe('REJECTED');
  });

  it('update on nonexistent id is a no-op', async () => {
    await repo.update(makePendingSuggestion({ suggestionId: 'nonexistent' }));
    expect(repo.suggestions).toHaveLength(0);
  });

  it('multiple suggestions can be stored and retrieved independently', async () => {
    await repo.save(makePendingSuggestion({ suggestionId: 'sug-1', confidenceScore: 0.9 }));
    await repo.save(makePendingSuggestion({ suggestionId: 'sug-2', confidenceScore: 0.7 }));

    const s1 = await repo.findById('sug-1');
    const s2 = await repo.findById('sug-2');
    expect(s1!.confidenceScore).toBe(0.9);
    expect(s2!.confidenceScore).toBe(0.7);
  });
});

// ═══════════════════════════════════════════════════════════════
// C. Suggestion-evidence link repository contract
// ═══════════════════════════════════════════════════════════════

describe('Link repository contract', () => {
  let repo: InMemoryLinkRepo;

  beforeEach(() => {
    repo = new InMemoryLinkRepo();
  });

  const makeLink = (id: string, sugId: string, evId: string): PolicySuggestionEvidenceLink => ({
    id,
    suggestionId: sugId,
    evidenceId: evId,
    createdAt: '2026-03-25T10:00:00Z',
  });

  it('save creates a link retrievable by findBySuggestionId', async () => {
    await repo.save(makeLink('link-1', 'sug-1', 'ev-1'));

    const links = await repo.findBySuggestionId('sug-1');
    expect(links).toHaveLength(1);
    expect(links[0].id).toBe('link-1');
    expect(links[0].evidenceId).toBe('ev-1');
  });

  it('saveBatch creates multiple links correctly', async () => {
    await repo.saveBatch([
      makeLink('link-1', 'sug-1', 'ev-1'),
      makeLink('link-2', 'sug-1', 'ev-2'),
      makeLink('link-3', 'sug-1', 'ev-3'),
    ]);

    const links = await repo.findBySuggestionId('sug-1');
    expect(links).toHaveLength(3);
    expect(links.map(l => l.evidenceId).sort()).toEqual(['ev-1', 'ev-2', 'ev-3']);
  });

  it('findBySuggestionId returns only links for that suggestion', async () => {
    await repo.saveBatch([
      makeLink('link-1', 'sug-1', 'ev-1'),
      makeLink('link-2', 'sug-2', 'ev-2'),
      makeLink('link-3', 'sug-1', 'ev-3'),
    ]);

    const sug1Links = await repo.findBySuggestionId('sug-1');
    expect(sug1Links).toHaveLength(2);
    expect(sug1Links.every(l => l.suggestionId === 'sug-1')).toBe(true);

    const sug2Links = await repo.findBySuggestionId('sug-2');
    expect(sug2Links).toHaveLength(1);
    expect(sug2Links[0].evidenceId).toBe('ev-2');
  });

  it('findByEvidenceId returns reverse links', async () => {
    await repo.saveBatch([
      makeLink('link-1', 'sug-1', 'ev-shared'),
      makeLink('link-2', 'sug-2', 'ev-shared'),
      makeLink('link-3', 'sug-1', 'ev-other'),
    ]);

    const sharedLinks = await repo.findByEvidenceId('ev-shared');
    expect(sharedLinks).toHaveLength(2);
    expect(sharedLinks.map(l => l.suggestionId).sort()).toEqual(['sug-1', 'sug-2']);
  });

  it('findBySuggestionId returns empty for nonexistent suggestion', async () => {
    expect(await repo.findBySuggestionId('nonexistent')).toEqual([]);
  });

  it('findByEvidenceId returns empty for nonexistent evidence', async () => {
    expect(await repo.findByEvidenceId('nonexistent')).toEqual([]);
  });

  it('repeated saveBatch appends duplicate links (no dedup at repo level)', async () => {
    const batch = [makeLink('link-1', 'sug-1', 'ev-1')];
    await repo.saveBatch(batch);
    await repo.saveBatch(batch);

    const links = await repo.findBySuggestionId('sug-1');
    expect(links).toHaveLength(2);
    expect(links[0].id).toBe('link-1');
    expect(links[1].id).toBe('link-1');
  });
});

// ═══════════════════════════════════════════════════════════════
// D. Cross-repository integrity flow
// ═══════════════════════════════════════════════════════════════

describe('Cross-repository integrity flow', () => {
  let evidenceRepo: InMemoryEvidenceRepo;
  let suggestionRepo: InMemorySuggestionRepo;
  let linkRepo: InMemoryLinkRepo;
  let ids: ReturnType<typeof makeIdGenerator>;

  const overlays: OverlayCoverageRecord[] = [
    { overlayId: 'o1', familyId: 'fam-1', date: '2026-03-05', childId: 'c1', assignedParentId: 'p1', disruptionType: 'SCHOOL_CLOSURE' },
    { overlayId: 'o2', familyId: 'fam-1', date: '2026-03-12', childId: 'c1', assignedParentId: 'p1', disruptionType: 'SCHOOL_CLOSURE' },
    { overlayId: 'o3', familyId: 'fam-1', date: '2026-03-19', childId: 'c1', assignedParentId: 'p1', disruptionType: 'SCHOOL_CLOSURE' },
    { overlayId: 'o4', familyId: 'fam-1', date: '2026-03-26', childId: 'c1', assignedParentId: 'p1', disruptionType: 'SCHOOL_CLOSURE' },
  ];

  const WINDOW: BehaviorObservationWindow = {
    familyId: 'fam-1',
    startDate: '2026-03-01',
    endDate: '2026-03-31',
  };

  beforeEach(() => {
    evidenceRepo = new InMemoryEvidenceRepo();
    suggestionRepo = new InMemorySuggestionRepo();
    linkRepo = new InMemoryLinkRepo();
    ids = makeIdGenerator();
  });

  function createService() {
    return new PolicySuggestionService({
      extractors: [new OverlayCoverageEvidenceExtractor(overlays)],
      detectorRegistry: new PatternDetectorRegistry(),
      evidenceRepository: evidenceRepo,
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      idGenerator: ids.gen,
    });
  }

  it('generateSuggestions persists evidence, suggestion, and links coherently', async () => {
    const service = createService();
    const suggestions = await service.generateSuggestions({ window: WINDOW });

    expect(suggestions).toHaveLength(1);

    // Evidence persisted
    expect(evidenceRepo.records).toHaveLength(4);
    const evidenceIds = evidenceRepo.records.map(r => r.evidenceId).sort();
    expect(evidenceIds).toEqual(['overlay-o1', 'overlay-o2', 'overlay-o3', 'overlay-o4']);

    // Suggestion persisted
    expect(suggestionRepo.suggestions).toHaveLength(1);
    const stored = suggestionRepo.suggestions[0];
    expect(stored.suggestionId).toBe(suggestions[0].suggestionId);
    expect(stored.status).toBe('PENDING_REVIEW');

    // Links connect the correct suggestion to the correct evidence
    const links = await linkRepo.findBySuggestionId(stored.suggestionId);
    expect(links).toHaveLength(4);
    const linkedEvidenceIds = links.map(l => l.evidenceId).sort();
    expect(linkedEvidenceIds).toEqual(evidenceIds);
  });

  it('every link evidence ID refers to a real persisted evidence record', async () => {
    const service = createService();
    const suggestions = await service.generateSuggestions({ window: WINDOW });

    const links = await linkRepo.findBySuggestionId(suggestions[0].suggestionId);
    for (const link of links) {
      const evidence = await evidenceRepo.findById(link.evidenceId);
      expect(evidence).not.toBeNull();
      expect(evidence!.familyId).toBe('fam-1');
    }
  });

  it('every link suggestion ID refers to a real persisted suggestion', async () => {
    const service = createService();
    const suggestions = await service.generateSuggestions({ window: WINDOW });

    const links = linkRepo.links;
    for (const link of links) {
      const suggestion = await suggestionRepo.findById(link.suggestionId);
      expect(suggestion).not.toBeNull();
      expect(suggestion!.familyId).toBe('fam-1');
    }
  });

  it('review service reads coherent persisted state', async () => {
    const service = createService();
    const suggestions = await service.generateSuggestions({ window: WINDOW });

    const reviewService = new PolicySuggestionReviewService({
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      evidenceRepository: evidenceRepo,
    });

    const bundle = await reviewService.getReviewBundle(suggestions[0].suggestionId);

    // Review service reads from repos and reconstructs consistent state
    expect(bundle.suggestionId).toBe(suggestions[0].suggestionId);
    expect(bundle.confidenceScore).toBe(suggestions[0].confidenceScore);
    expect(bundle.evidenceSummary.occurrenceCount).toBe(4);

    const countArtifact = bundle.artifacts.find(a => a.type === 'EVIDENCE_COUNT_SUMMARY')!;
    expect(countArtifact.data.totalEvidenceCount).toBe(4);
  });

  it('reverse link lookup from evidence finds the correct suggestion', async () => {
    const service = createService();
    const suggestions = await service.generateSuggestions({ window: WINDOW });

    const reverseLinks = await linkRepo.findByEvidenceId('overlay-o1');
    expect(reverseLinks).toHaveLength(1);
    expect(reverseLinks[0].suggestionId).toBe(suggestions[0].suggestionId);
  });
});

// ═══════════════════════════════════════════════════════════════
// E. Resolution persistence behavior
// ═══════════════════════════════════════════════════════════════

describe('Resolution persistence behavior', () => {
  let evidenceRepo: InMemoryEvidenceRepo;
  let suggestionRepo: InMemorySuggestionRepo;
  let linkRepo: InMemoryLinkRepo;
  let policyRepo: InMemoryPolicyRuleRepo;
  let ids: ReturnType<typeof makeIdGenerator>;

  const overlays: OverlayCoverageRecord[] = [
    { overlayId: 'o1', familyId: 'fam-1', date: '2026-03-05', childId: 'c1', assignedParentId: 'p1', disruptionType: 'SCHOOL_CLOSURE' },
    { overlayId: 'o2', familyId: 'fam-1', date: '2026-03-12', childId: 'c1', assignedParentId: 'p1', disruptionType: 'SCHOOL_CLOSURE' },
    { overlayId: 'o3', familyId: 'fam-1', date: '2026-03-19', childId: 'c1', assignedParentId: 'p1', disruptionType: 'SCHOOL_CLOSURE' },
    { overlayId: 'o4', familyId: 'fam-1', date: '2026-03-26', childId: 'c1', assignedParentId: 'p1', disruptionType: 'SCHOOL_CLOSURE' },
  ];

  const WINDOW: BehaviorObservationWindow = {
    familyId: 'fam-1',
    startDate: '2026-03-01',
    endDate: '2026-03-31',
  };

  beforeEach(() => {
    evidenceRepo = new InMemoryEvidenceRepo();
    suggestionRepo = new InMemorySuggestionRepo();
    linkRepo = new InMemoryLinkRepo();
    policyRepo = new InMemoryPolicyRuleRepo();
    ids = makeIdGenerator();
  });

  function createService() {
    return new PolicySuggestionService({
      extractors: [new OverlayCoverageEvidenceExtractor(overlays)],
      detectorRegistry: new PatternDetectorRegistry(),
      evidenceRepository: evidenceRepo,
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      idGenerator: ids.gen,
    });
  }

  it('accepting updates suggestion status and creates exactly one rule', async () => {
    const service = createService();
    const suggestions = await service.generateSuggestions({ window: WINDOW });

    const workflow = new PolicySuggestionResolutionWorkflow({
      suggestionRepository: suggestionRepo,
      policyRuleRepository: policyRepo,
      idGenerator: ids.gen,
    });

    await workflow.resolveSuggestion({
      suggestionId: suggestions[0].suggestionId,
      decision: 'ACCEPT',
      resolvedAt: '2026-03-28T10:00:00Z',
      resolvedBy: 'parent-p1',
    });

    // Suggestion updated in repo
    const updated = await suggestionRepo.findById(suggestions[0].suggestionId);
    expect(updated!.status).toBe('ACCEPTED');
    expect(updated!.resolvedAt).toBe('2026-03-28T10:00:00Z');
    expect(updated!.resolvedBy).toBe('parent-p1');

    // Exactly one rule
    expect(policyRepo.rules).toHaveLength(1);
    const rule = policyRepo.rules[0];
    expect(rule.active).toBe(true);
    expect(rule.familyId).toBe('fam-1');
  });

  it('acceptance preserves prior evidence and links', async () => {
    const service = createService();
    const suggestions = await service.generateSuggestions({ window: WINDOW });
    const evidenceCountBefore = evidenceRepo.records.length;
    const linkCountBefore = linkRepo.links.length;

    const workflow = new PolicySuggestionResolutionWorkflow({
      suggestionRepository: suggestionRepo,
      policyRuleRepository: policyRepo,
      idGenerator: ids.gen,
    });

    await workflow.resolveSuggestion({
      suggestionId: suggestions[0].suggestionId,
      decision: 'ACCEPT',
      resolvedAt: '2026-03-28T10:00:00Z',
      resolvedBy: 'parent-p1',
    });

    // Evidence and links unchanged
    expect(evidenceRepo.records.length).toBe(evidenceCountBefore);
    expect(linkRepo.links.length).toBe(linkCountBefore);

    // Links still point to the suggestion
    const links = await linkRepo.findBySuggestionId(suggestions[0].suggestionId);
    expect(links).toHaveLength(4);
  });

  it('rejection updates status without creating policy rules', async () => {
    const service = createService();
    const suggestions = await service.generateSuggestions({ window: WINDOW });

    const workflow = new PolicySuggestionResolutionWorkflow({
      suggestionRepository: suggestionRepo,
      policyRuleRepository: policyRepo,
      idGenerator: ids.gen,
    });

    await workflow.resolveSuggestion({
      suggestionId: suggestions[0].suggestionId,
      decision: 'REJECT',
      resolvedAt: '2026-03-28T10:00:00Z',
      resolvedBy: 'parent-p2',
    });

    const updated = await suggestionRepo.findById(suggestions[0].suggestionId);
    expect(updated!.status).toBe('REJECTED');
    expect(updated!.resolvedBy).toBe('parent-p2');
    expect(policyRepo.rules).toHaveLength(0);
  });

  it('rejected suggestion is still queryable via findByFamilyId but not pending', async () => {
    const service = createService();
    const suggestions = await service.generateSuggestions({ window: WINDOW });

    const workflow = new PolicySuggestionResolutionWorkflow({
      suggestionRepository: suggestionRepo,
      policyRuleRepository: policyRepo,
      idGenerator: ids.gen,
    });

    await workflow.resolveSuggestion({
      suggestionId: suggestions[0].suggestionId,
      decision: 'REJECT',
      resolvedAt: '2026-03-28T10:00:00Z',
      resolvedBy: 'parent-p1',
    });

    const all = await suggestionRepo.findByFamilyId('fam-1');
    expect(all).toHaveLength(1);
    expect(all[0].status).toBe('REJECTED');

    const pending = await suggestionRepo.findPendingByFamilyId('fam-1');
    expect(pending).toHaveLength(0);
  });

  it('failed unsupported acceptance does not corrupt suggestion state', async () => {
    // Manually insert a PREFERRED_EXCHANGE_DAY suggestion (unsupported)
    await suggestionRepo.save(makePendingSuggestion({
      suggestionId: 'sug-day',
      suggestionType: 'PREFERRED_EXCHANGE_DAY',
      proposedRuleType: 'EXCHANGE_LOCATION',
      proposedParameters: { preferredExchangeDay: 0 },
    }));

    const workflow = new PolicySuggestionResolutionWorkflow({
      suggestionRepository: suggestionRepo,
      policyRuleRepository: policyRepo,
      idGenerator: ids.gen,
    });

    await expect(
      workflow.resolveSuggestion({
        suggestionId: 'sug-day',
        decision: 'ACCEPT',
        resolvedAt: '2026-03-28T10:00:00Z',
        resolvedBy: 'parent-p1',
      }),
    ).rejects.toThrow('Unsupported suggestion conversion');

    // Suggestion unchanged — still PENDING_REVIEW
    const s = await suggestionRepo.findById('sug-day');
    expect(s!.status).toBe('PENDING_REVIEW');
    expect(s!.resolvedAt).toBeUndefined();
    expect(s!.resolvedBy).toBeUndefined();

    // No policy rules created
    expect(policyRepo.rules).toHaveLength(0);

    // Suggestion is still in pending query
    const pending = await suggestionRepo.findPendingByFamilyId('fam-1');
    expect(pending).toHaveLength(1);
    expect(pending[0].suggestionId).toBe('sug-day');
  });
});

// ═══════════════════════════════════════════════════════════════
// F. Repeated-run persistence semantics
// ═══════════════════════════════════════════════════════════════

describe('Repeated-run persistence semantics', () => {
  let evidenceRepo: InMemoryEvidenceRepo;
  let suggestionRepo: InMemorySuggestionRepo;
  let linkRepo: InMemoryLinkRepo;
  let policyRepo: InMemoryPolicyRuleRepo;
  let ids: ReturnType<typeof makeIdGenerator>;

  const overlays: OverlayCoverageRecord[] = [
    { overlayId: 'o1', familyId: 'fam-1', date: '2026-03-05', childId: 'c1', assignedParentId: 'p1', disruptionType: 'SCHOOL_CLOSURE' },
    { overlayId: 'o2', familyId: 'fam-1', date: '2026-03-12', childId: 'c1', assignedParentId: 'p1', disruptionType: 'SCHOOL_CLOSURE' },
    { overlayId: 'o3', familyId: 'fam-1', date: '2026-03-19', childId: 'c1', assignedParentId: 'p1', disruptionType: 'SCHOOL_CLOSURE' },
    { overlayId: 'o4', familyId: 'fam-1', date: '2026-03-26', childId: 'c1', assignedParentId: 'p1', disruptionType: 'SCHOOL_CLOSURE' },
  ];

  const WINDOW: BehaviorObservationWindow = {
    familyId: 'fam-1',
    startDate: '2026-03-01',
    endDate: '2026-03-31',
  };

  beforeEach(() => {
    evidenceRepo = new InMemoryEvidenceRepo();
    suggestionRepo = new InMemorySuggestionRepo();
    linkRepo = new InMemoryLinkRepo();
    policyRepo = new InMemoryPolicyRuleRepo();
    ids = makeIdGenerator();
  });

  function createService() {
    return new PolicySuggestionService({
      extractors: [new OverlayCoverageEvidenceExtractor(overlays)],
      detectorRegistry: new PatternDetectorRegistry(),
      evidenceRepository: evidenceRepo,
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      idGenerator: ids.gen,
    });
  }

  it('evidence accumulates: 4 after run 1, 8 after run 2, 12 after run 3', async () => {
    const service = createService();

    await service.generateSuggestions({ window: WINDOW });
    expect(evidenceRepo.records).toHaveLength(4);

    await service.generateSuggestions({ window: WINDOW });
    expect(evidenceRepo.records).toHaveLength(8);

    await service.generateSuggestions({ window: WINDOW });
    expect(evidenceRepo.records).toHaveLength(12);
  });

  it('pending suggestions do not duplicate when matching pending exists', async () => {
    const service = createService();

    await service.generateSuggestions({ window: WINDOW });
    expect(suggestionRepo.suggestions).toHaveLength(1);

    await service.generateSuggestions({ window: WINDOW });
    expect(suggestionRepo.suggestions).toHaveLength(1);

    await service.generateSuggestions({ window: WINDOW });
    expect(suggestionRepo.suggestions).toHaveLength(1);

    expect(suggestionRepo.suggestions[0].status).toBe('PENDING_REVIEW');
  });

  it('links do not duplicate when no new suggestion is created', async () => {
    const service = createService();

    await service.generateSuggestions({ window: WINDOW });
    const linksAfterFirst = linkRepo.links.length;

    await service.generateSuggestions({ window: WINDOW });
    expect(linkRepo.links.length).toBe(linksAfterFirst);

    await service.generateSuggestions({ window: WINDOW });
    expect(linkRepo.links.length).toBe(linksAfterFirst);
  });

  it('after acceptance, rerun creates new pending because dedup only checks pending', async () => {
    const service = createService();
    const first = await service.generateSuggestions({ window: WINDOW });

    const workflow = new PolicySuggestionResolutionWorkflow({
      suggestionRepository: suggestionRepo,
      policyRuleRepository: policyRepo,
      idGenerator: ids.gen,
    });

    await workflow.resolveSuggestion({
      suggestionId: first[0].suggestionId,
      decision: 'ACCEPT',
      resolvedAt: '2026-03-28T10:00:00Z',
      resolvedBy: 'parent-p1',
    });

    // Accepted → not pending → dedup allows new suggestion
    const second = await service.generateSuggestions({ window: WINDOW });
    expect(second).toHaveLength(1);
    expect(second[0].suggestionId).not.toBe(first[0].suggestionId);
    expect(second[0].status).toBe('PENDING_REVIEW');

    // Total: 1 accepted + 1 pending
    expect(suggestionRepo.suggestions).toHaveLength(2);
    const statuses = suggestionRepo.suggestions.map(s => s.status).sort();
    expect(statuses).toEqual(['ACCEPTED', 'PENDING_REVIEW']);
  });

  it('after rejection, rerun creates new pending for same reason', async () => {
    const service = createService();
    const first = await service.generateSuggestions({ window: WINDOW });

    const workflow = new PolicySuggestionResolutionWorkflow({
      suggestionRepository: suggestionRepo,
      policyRuleRepository: policyRepo,
      idGenerator: ids.gen,
    });

    await workflow.resolveSuggestion({
      suggestionId: first[0].suggestionId,
      decision: 'REJECT',
      resolvedAt: '2026-03-28T10:00:00Z',
      resolvedBy: 'parent-p1',
    });

    const second = await service.generateSuggestions({ window: WINDOW });
    expect(second).toHaveLength(1);

    // Total: 1 rejected + 1 pending
    expect(suggestionRepo.suggestions).toHaveLength(2);
    const statuses = suggestionRepo.suggestions.map(s => s.status).sort();
    expect(statuses).toEqual(['PENDING_REVIEW', 'REJECTED']);
  });

  it('new links are created for the new suggestion after acceptance + rerun', async () => {
    const service = createService();
    const first = await service.generateSuggestions({ window: WINDOW });
    const firstLinks = linkRepo.links.length;

    const workflow = new PolicySuggestionResolutionWorkflow({
      suggestionRepository: suggestionRepo,
      policyRuleRepository: policyRepo,
      idGenerator: ids.gen,
    });

    await workflow.resolveSuggestion({
      suggestionId: first[0].suggestionId,
      decision: 'ACCEPT',
      resolvedAt: '2026-03-28T10:00:00Z',
      resolvedBy: 'parent-p1',
    });

    const second = await service.generateSuggestions({ window: WINDOW });

    // New links were created for the second suggestion
    expect(linkRepo.links.length).toBe(firstLinks + 4);

    // First suggestion links still intact
    const firstSugLinks = await linkRepo.findBySuggestionId(first[0].suggestionId);
    expect(firstSugLinks).toHaveLength(4);

    // Second suggestion has its own links
    const secondSugLinks = await linkRepo.findBySuggestionId(second[0].suggestionId);
    expect(secondSugLinks).toHaveLength(4);
  });

  it('active policy rule does not suppress future suggestions (current design)', async () => {
    const service = createService();
    const first = await service.generateSuggestions({ window: WINDOW });

    const workflow = new PolicySuggestionResolutionWorkflow({
      suggestionRepository: suggestionRepo,
      policyRuleRepository: policyRepo,
      idGenerator: ids.gen,
    });

    await workflow.resolveSuggestion({
      suggestionId: first[0].suggestionId,
      decision: 'ACCEPT',
      resolvedAt: '2026-03-28T10:00:00Z',
      resolvedBy: 'parent-p1',
    });

    // Active rule exists
    const activeRules = await policyRepo.findActiveByFamilyId('fam-1');
    expect(activeRules).toHaveLength(1);

    // Rerun still generates a new suggestion — current design does not
    // check for existing active rules that cover the same pattern
    const second = await service.generateSuggestions({ window: WINDOW });
    expect(second).toHaveLength(1);
    expect(second[0].suggestionType).toBe('SCHOOL_CLOSURE_COVERAGE_PREFERENCE');

    // This is a documented design decision, not a bug:
    // The deduplicator only checks pending suggestions, not active rules
  });
});
