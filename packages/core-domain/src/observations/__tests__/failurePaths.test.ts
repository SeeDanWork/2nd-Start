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
import { IObservationEvidenceRepository } from '../repositories/IObservationEvidenceRepository';
import { IPolicySuggestionRepository } from '../repositories/IPolicySuggestionRepository';
import { IPolicySuggestionEvidenceLinkRepository } from '../repositories/IPolicySuggestionEvidenceLinkRepository';
import { IPolicyRuleRepository } from '../../policy/repositories/IPolicyRuleRepository';
import { TypedPolicyRule } from '../../policy/types/TypedPolicyRule';
import {
  InMemoryEvidenceRepo,
  InMemorySuggestionRepo,
  InMemoryLinkRepo,
  InMemoryPolicyRuleRepo,
  makePendingSuggestion,
  makeIdGenerator,
} from './helpers';

// ─── Failing repo test doubles ───────────────────────────────

class FailOnUpdateSuggestionRepo extends InMemorySuggestionRepo {
  async update(_s: PolicySuggestion): Promise<void> {
    throw new Error('Simulated suggestion update failure');
  }
}

class FailOnSaveSuggestionRepo extends InMemorySuggestionRepo {
  async save(_s: PolicySuggestion): Promise<void> {
    throw new Error('Simulated suggestion save failure');
  }
}

class FailOnSavePolicyRuleRepo extends InMemoryPolicyRuleRepo {
  async save(_r: TypedPolicyRule): Promise<void> {
    throw new Error('Simulated rule save failure');
  }
}

class FailOnSaveBatchEvidenceRepo extends InMemoryEvidenceRepo {
  async saveBatch(_rs: ObservationEvidenceRecord[]): Promise<void> {
    throw new Error('Simulated evidence saveBatch failure');
  }
}

class FailOnSaveBatchLinkRepo extends InMemoryLinkRepo {
  async saveBatch(_ls: PolicySuggestionEvidenceLink[]): Promise<void> {
    throw new Error('Simulated link saveBatch failure');
  }
}

class FailOnFindByIdsSuggestionRepo extends InMemorySuggestionRepo {}

class FailOnFindByIdsEvidenceRepo extends InMemoryEvidenceRepo {
  async findByIds(_ids: string[]): Promise<ObservationEvidenceRecord[]> {
    throw new Error('Simulated evidence findByIds failure');
  }
}

class FailOnFindBySuggestionIdLinkRepo extends InMemoryLinkRepo {
  async findBySuggestionId(_sid: string): Promise<PolicySuggestionEvidenceLink[]> {
    throw new Error('Simulated link findBySuggestionId failure');
  }
}

// Repo that returns results in reverse insertion order
class ReversedEvidenceRepo extends InMemoryEvidenceRepo {
  async findByIds(ids: string[]) {
    return this.records.filter(r => ids.includes(r.evidenceId)).reverse();
  }
  async findByFamilyId(fid: string) {
    return this.records.filter(r => r.familyId === fid).reverse();
  }
}

class ReversedSuggestionRepo extends InMemorySuggestionRepo {
  async findPendingByFamilyId(fid: string) {
    return this.suggestions.filter(s => s.familyId === fid && s.status === 'PENDING_REVIEW').reverse();
  }
  async findByFamilyId(fid: string) {
    return this.suggestions.filter(s => s.familyId === fid).reverse();
  }
}

class ReversedLinkRepo extends InMemoryLinkRepo {
  async findBySuggestionId(sid: string) {
    return this.links.filter(l => l.suggestionId === sid).reverse();
  }
}

// ─── Shared fixtures ─────────────────────────────────────────

const WINDOW: BehaviorObservationWindow = {
  familyId: 'fam-1',
  startDate: '2026-03-01',
  endDate: '2026-03-31',
};

const overlays: OverlayCoverageRecord[] = [
  { overlayId: 'o1', familyId: 'fam-1', date: '2026-03-05', childId: 'c1', assignedParentId: 'p1', disruptionType: 'SCHOOL_CLOSURE' },
  { overlayId: 'o2', familyId: 'fam-1', date: '2026-03-12', childId: 'c1', assignedParentId: 'p1', disruptionType: 'SCHOOL_CLOSURE' },
  { overlayId: 'o3', familyId: 'fam-1', date: '2026-03-19', childId: 'c1', assignedParentId: 'p1', disruptionType: 'SCHOOL_CLOSURE' },
  { overlayId: 'o4', familyId: 'fam-1', date: '2026-03-26', childId: 'c1', assignedParentId: 'p1', disruptionType: 'SCHOOL_CLOSURE' },
];

// ═══════════════════════════════════════════════════════════════
// A. Resolution partial-failure safety
// ═══════════════════════════════════════════════════════════════

describe('Resolution partial-failure safety', () => {
  let ids: ReturnType<typeof makeIdGenerator>;

  beforeEach(() => {
    ids = makeIdGenerator();
  });

  it('rule save succeeds but suggestion update fails — rule exists, suggestion mutated in-memory (non-atomic)', async () => {
    // The resolution workflow: saves rule first, then updates suggestion.
    // If update throws, the rule is already persisted.
    // Additionally, in-memory findById returns a reference, so the mutation
    // at lines 135-137 already changes the stored object before update() runs.
    const suggestionRepo = new FailOnUpdateSuggestionRepo();
    const policyRepo = new InMemoryPolicyRuleRepo();

    await suggestionRepo.save(makePendingSuggestion({ suggestionId: 'sug-1' }));

    const workflow = new PolicySuggestionResolutionWorkflow({
      suggestionRepository: suggestionRepo,
      policyRuleRepository: policyRepo,
      idGenerator: ids.gen,
    });

    await expect(
      workflow.resolveSuggestion({
        suggestionId: 'sug-1',
        decision: 'ACCEPT',
        resolvedAt: '2026-03-28T10:00:00Z',
        resolvedBy: 'parent-p1',
      }),
    ).rejects.toThrow('Simulated suggestion update failure');

    // Rule was saved BEFORE the update call — it persists
    expect(policyRepo.rules).toHaveLength(1);
    expect(policyRepo.rules[0].active).toBe(true);

    // In-memory behavior: suggestion object was mutated directly on the
    // reference returned by findById. The mutation at line 135 happens
    // before the failing update() call. So the in-memory state IS changed.
    const s = await suggestionRepo.findById('sug-1');
    expect(s!.status).toBe('ACCEPTED');
    // This documents non-atomic behavior: rule created + suggestion mutated
    // even though update() threw. A real DB would leave suggestion as PENDING_REVIEW.
  });

  it('rule save fails — no rule created, suggestion remains PENDING_REVIEW', async () => {
    const suggestionRepo = new InMemorySuggestionRepo();
    const policyRepo = new FailOnSavePolicyRuleRepo();

    await suggestionRepo.save(makePendingSuggestion({ suggestionId: 'sug-1' }));

    const workflow = new PolicySuggestionResolutionWorkflow({
      suggestionRepository: suggestionRepo,
      policyRuleRepository: policyRepo,
      idGenerator: ids.gen,
    });

    await expect(
      workflow.resolveSuggestion({
        suggestionId: 'sug-1',
        decision: 'ACCEPT',
        resolvedAt: '2026-03-28T10:00:00Z',
        resolvedBy: 'parent-p1',
      }),
    ).rejects.toThrow('Simulated rule save failure');

    // Rule save failed — no rules
    expect(policyRepo.rules).toHaveLength(0);

    // Suggestion unchanged — mutation happens AFTER rule save
    const s = await suggestionRepo.findById('sug-1');
    expect(s!.status).toBe('PENDING_REVIEW');
    expect(s!.resolvedAt).toBeUndefined();
  });

  it('reject path — update throws, but in-memory state is already mutated', async () => {
    const suggestionRepo = new FailOnUpdateSuggestionRepo();
    const policyRepo = new InMemoryPolicyRuleRepo();

    await suggestionRepo.save(makePendingSuggestion({ suggestionId: 'sug-1' }));

    const workflow = new PolicySuggestionResolutionWorkflow({
      suggestionRepository: suggestionRepo,
      policyRuleRepository: policyRepo,
      idGenerator: ids.gen,
    });

    await expect(
      workflow.resolveSuggestion({
        suggestionId: 'sug-1',
        decision: 'REJECT',
        resolvedAt: '2026-03-28T10:00:00Z',
        resolvedBy: 'parent-p1',
      }),
    ).rejects.toThrow('Simulated suggestion update failure');

    // No rules created on reject path
    expect(policyRepo.rules).toHaveLength(0);

    // In-memory: status mutated on reference before update() threw
    const s = await suggestionRepo.findById('sug-1');
    expect(s!.status).toBe('REJECTED');
  });
});

// ═══════════════════════════════════════════════════════════════
// B. Generation/review failure propagation
// ═══════════════════════════════════════════════════════════════

describe('Generation failure propagation', () => {
  let ids: ReturnType<typeof makeIdGenerator>;

  beforeEach(() => {
    ids = makeIdGenerator();
  });

  it('evidence saveBatch failure propagates — no suggestions or links saved', async () => {
    const evidenceRepo = new FailOnSaveBatchEvidenceRepo();
    const suggestionRepo = new InMemorySuggestionRepo();
    const linkRepo = new InMemoryLinkRepo();

    const service = new PolicySuggestionService({
      extractors: [new OverlayCoverageEvidenceExtractor(overlays)],
      detectorRegistry: new PatternDetectorRegistry(),
      evidenceRepository: evidenceRepo,
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      idGenerator: ids.gen,
    });

    await expect(
      service.generateSuggestions({ window: WINDOW }),
    ).rejects.toThrow('Simulated evidence saveBatch failure');

    // Nothing persisted because evidence save happens first
    expect(evidenceRepo.records).toHaveLength(0);
    expect(suggestionRepo.suggestions).toHaveLength(0);
    expect(linkRepo.links).toHaveLength(0);
  });

  it('suggestion save failure propagates — evidence saved but no suggestions/links', async () => {
    const evidenceRepo = new InMemoryEvidenceRepo();
    const suggestionRepo = new FailOnSaveSuggestionRepo();
    const linkRepo = new InMemoryLinkRepo();

    const service = new PolicySuggestionService({
      extractors: [new OverlayCoverageEvidenceExtractor(overlays)],
      detectorRegistry: new PatternDetectorRegistry(),
      evidenceRepository: evidenceRepo,
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      idGenerator: ids.gen,
    });

    await expect(
      service.generateSuggestions({ window: WINDOW }),
    ).rejects.toThrow('Simulated suggestion save failure');

    // Evidence was saved before suggestion save
    expect(evidenceRepo.records).toHaveLength(4);

    // No suggestions or links
    expect(suggestionRepo.suggestions).toHaveLength(0);
    expect(linkRepo.links).toHaveLength(0);
  });

  it('link saveBatch failure propagates — evidence and suggestion saved, no links', async () => {
    const evidenceRepo = new InMemoryEvidenceRepo();
    const suggestionRepo = new InMemorySuggestionRepo();
    const linkRepo = new FailOnSaveBatchLinkRepo();

    const service = new PolicySuggestionService({
      extractors: [new OverlayCoverageEvidenceExtractor(overlays)],
      detectorRegistry: new PatternDetectorRegistry(),
      evidenceRepository: evidenceRepo,
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      idGenerator: ids.gen,
    });

    await expect(
      service.generateSuggestions({ window: WINDOW }),
    ).rejects.toThrow('Simulated link saveBatch failure');

    // Evidence and suggestion saved before link failure
    expect(evidenceRepo.records).toHaveLength(4);
    expect(suggestionRepo.suggestions).toHaveLength(1);

    // No links saved
    expect(linkRepo.links).toHaveLength(0);

    // This is partial state: suggestion exists but has no evidence links.
    // A retry or cleanup would need to handle this.
  });
});

describe('Review failure propagation', () => {
  it('link lookup failure propagates from getReviewBundle', async () => {
    const suggestionRepo = new InMemorySuggestionRepo();
    await suggestionRepo.save(makePendingSuggestion({ suggestionId: 'sug-1' }));

    const reviewService = new PolicySuggestionReviewService({
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: new FailOnFindBySuggestionIdLinkRepo(),
      evidenceRepository: new InMemoryEvidenceRepo(),
    });

    await expect(
      reviewService.getReviewBundle('sug-1'),
    ).rejects.toThrow('Simulated link findBySuggestionId failure');
  });

  it('evidence findByIds failure propagates from getReviewBundle', async () => {
    const suggestionRepo = new InMemorySuggestionRepo();
    const linkRepo = new InMemoryLinkRepo();
    await suggestionRepo.save(makePendingSuggestion({ suggestionId: 'sug-1' }));
    await linkRepo.save({ id: 'link-1', suggestionId: 'sug-1', evidenceId: 'ev-1', createdAt: '2026-03-25T10:00:00Z' });

    const reviewService = new PolicySuggestionReviewService({
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      evidenceRepository: new FailOnFindByIdsEvidenceRepo(),
    });

    await expect(
      reviewService.getReviewBundle('sug-1'),
    ).rejects.toThrow('Simulated evidence findByIds failure');
  });

  it('missing linked evidence degrades gracefully — review bundle has 0 evidence count', async () => {
    const suggestionRepo = new InMemorySuggestionRepo();
    const linkRepo = new InMemoryLinkRepo();
    const evidenceRepo = new InMemoryEvidenceRepo();

    await suggestionRepo.save(makePendingSuggestion({ suggestionId: 'sug-1' }));
    // Links reference evidence that doesn't exist
    await linkRepo.saveBatch([
      { id: 'link-1', suggestionId: 'sug-1', evidenceId: 'ev-missing-1', createdAt: '2026-03-25T10:00:00Z' },
      { id: 'link-2', suggestionId: 'sug-1', evidenceId: 'ev-missing-2', createdAt: '2026-03-25T10:00:00Z' },
    ]);

    const reviewService = new PolicySuggestionReviewService({
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      evidenceRepository: evidenceRepo,
    });

    // Does not throw — findByIds returns empty for missing IDs
    const bundle = await reviewService.getReviewBundle('sug-1');
    expect(bundle.suggestionId).toBe('sug-1');

    // Evidence count artifact reflects zero linked evidence found
    const countArtifact = bundle.artifacts.find(a => a.type === 'EVIDENCE_COUNT_SUMMARY')!;
    expect(countArtifact.data.totalEvidenceCount).toBe(0);
  });

  it('suggestion with zero links returns valid review bundle', async () => {
    const suggestionRepo = new InMemorySuggestionRepo();
    const linkRepo = new InMemoryLinkRepo();
    const evidenceRepo = new InMemoryEvidenceRepo();

    await suggestionRepo.save(makePendingSuggestion({ suggestionId: 'sug-1' }));
    // No links at all

    const reviewService = new PolicySuggestionReviewService({
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      evidenceRepository: evidenceRepo,
    });

    const bundle = await reviewService.getReviewBundle('sug-1');
    expect(bundle.suggestionId).toBe('sug-1');
    expect(bundle.artifacts).toHaveLength(4);

    const countArtifact = bundle.artifacts.find(a => a.type === 'EVIDENCE_COUNT_SUMMARY')!;
    expect(countArtifact.data.totalEvidenceCount).toBe(0);
    expect(countArtifact.data.evidenceTypes).toEqual({});
  });

  it('link points to evidence that was deleted — review bundle shows partial evidence', async () => {
    const suggestionRepo = new InMemorySuggestionRepo();
    const linkRepo = new InMemoryLinkRepo();
    const evidenceRepo = new InMemoryEvidenceRepo();

    await suggestionRepo.save(makePendingSuggestion({ suggestionId: 'sug-1' }));

    // Save evidence, then create links, then "delete" some evidence
    const ev1: ObservationEvidenceRecord = {
      evidenceId: 'ev-1', familyId: 'fam-1', evidenceType: 'OVERLAY_COVERAGE',
      date: '2026-03-05', data: { assignedParentId: 'p1' }, createdAt: '2026-03-05T00:00:00Z',
    };
    const ev2: ObservationEvidenceRecord = {
      evidenceId: 'ev-2', familyId: 'fam-1', evidenceType: 'OVERLAY_COVERAGE',
      date: '2026-03-12', data: { assignedParentId: 'p1' }, createdAt: '2026-03-12T00:00:00Z',
    };
    await evidenceRepo.saveBatch([ev1, ev2]);
    await linkRepo.saveBatch([
      { id: 'link-1', suggestionId: 'sug-1', evidenceId: 'ev-1', createdAt: '2026-03-25T10:00:00Z' },
      { id: 'link-2', suggestionId: 'sug-1', evidenceId: 'ev-2', createdAt: '2026-03-25T10:00:00Z' },
      { id: 'link-3', suggestionId: 'sug-1', evidenceId: 'ev-deleted', createdAt: '2026-03-25T10:00:00Z' },
    ]);

    const reviewService = new PolicySuggestionReviewService({
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      evidenceRepository: evidenceRepo,
    });

    const bundle = await reviewService.getReviewBundle('sug-1');
    // 3 links but only 2 evidence records found — graceful degradation
    const countArtifact = bundle.artifacts.find(a => a.type === 'EVIDENCE_COUNT_SUMMARY')!;
    expect(countArtifact.data.totalEvidenceCount).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════
// C. Deterministic service behavior under unsorted repo returns
// ═══════════════════════════════════════════════════════════════

describe('Deterministic behavior under unsorted repo returns', () => {
  let ids: ReturnType<typeof makeIdGenerator>;

  beforeEach(() => {
    ids = makeIdGenerator();
  });

  it('review bundle is deterministic even when evidence repo returns unsorted', async () => {
    const evidenceRepo = new ReversedEvidenceRepo();
    const suggestionRepo = new InMemorySuggestionRepo();
    const linkRepo = new InMemoryLinkRepo();

    // Seed evidence in non-chronological order
    await evidenceRepo.saveBatch([
      { evidenceId: 'ev-3', familyId: 'fam-1', evidenceType: 'OVERLAY_COVERAGE', date: '2026-03-19', data: { val: 3 }, createdAt: '2026-03-19T00:00:00Z' },
      { evidenceId: 'ev-1', familyId: 'fam-1', evidenceType: 'OVERLAY_COVERAGE', date: '2026-03-05', data: { val: 1 }, createdAt: '2026-03-05T00:00:00Z' },
      { evidenceId: 'ev-2', familyId: 'fam-1', evidenceType: 'OVERLAY_COVERAGE', date: '2026-03-12', data: { val: 2 }, createdAt: '2026-03-12T00:00:00Z' },
    ]);

    await suggestionRepo.save(makePendingSuggestion({
      suggestionId: 'sug-1',
      evidenceSummary: {
        occurrenceCount: 3,
        windowStart: '2026-03-01',
        windowEnd: '2026-03-31',
        representativeExamples: [
          { date: '2026-03-05', data: { val: 1 } },
          { date: '2026-03-12', data: { val: 2 } },
        ],
      },
    }));

    await linkRepo.saveBatch([
      { id: 'link-1', suggestionId: 'sug-1', evidenceId: 'ev-1', createdAt: '2026-03-25T10:00:00Z' },
      { id: 'link-2', suggestionId: 'sug-1', evidenceId: 'ev-2', createdAt: '2026-03-25T10:00:00Z' },
      { id: 'link-3', suggestionId: 'sug-1', evidenceId: 'ev-3', createdAt: '2026-03-25T10:00:00Z' },
    ]);

    const reviewService = new PolicySuggestionReviewService({
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      evidenceRepository: evidenceRepo,
    });

    const b1 = await reviewService.getReviewBundle('sug-1');
    const b2 = await reviewService.getReviewBundle('sug-1');

    // Review service sorts evidence deterministically despite unsorted repo
    expect(b1.artifacts).toEqual(b2.artifacts);

    // Evidence count artifact reflects correct count
    const countArtifact = b1.artifacts.find(a => a.type === 'EVIDENCE_COUNT_SUMMARY')!;
    expect(countArtifact.data.totalEvidenceCount).toBe(3);
  });

  it('pending suggestions sorted deterministically despite reversed repo', async () => {
    const suggestionRepo = new ReversedSuggestionRepo();

    // Insert in order: high confidence first
    await suggestionRepo.save(makePendingSuggestion({
      suggestionId: 'sug-high',
      confidenceScore: 0.95,
      suggestionType: 'SCHOOL_CLOSURE_COVERAGE_PREFERENCE',
    }));
    await suggestionRepo.save(makePendingSuggestion({
      suggestionId: 'sug-low',
      confidenceScore: 0.7,
      suggestionType: 'MIN_BLOCK_LENGTH_ADJUSTMENT',
    }));

    // ReversedSuggestionRepo returns them reversed (low first)
    const service = new PolicySuggestionService({
      extractors: [],
      detectorRegistry: new PatternDetectorRegistry([]),
      evidenceRepository: new InMemoryEvidenceRepo(),
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: new InMemoryLinkRepo(),
      idGenerator: ids.gen,
    });

    const pending = await service.getPendingSuggestions({ familyId: 'fam-1' });

    // Service sorts by confidence descending
    expect(pending).toHaveLength(2);
    expect(pending[0].suggestionId).toBe('sug-high');
    expect(pending[0].confidenceScore).toBe(0.95);
    expect(pending[1].suggestionId).toBe('sug-low');
    expect(pending[1].confidenceScore).toBe(0.7);
  });

  it('deduplication works correctly when existing pending returned unsorted', async () => {
    const suggestionRepo = new ReversedSuggestionRepo();
    const evidenceRepo = new InMemoryEvidenceRepo();
    const linkRepo = new InMemoryLinkRepo();

    // Pre-existing pending suggestion
    await suggestionRepo.save(makePendingSuggestion({
      suggestionId: 'sug-existing',
      suggestionType: 'SCHOOL_CLOSURE_COVERAGE_PREFERENCE',
      proposedRuleType: 'ACTIVITY_COMMITMENT',
      proposedParameters: {
        activityLabel: 'school_closure_coverage',
        preferredResponsibleParentId: 'p1',
      },
      proposedScope: { scopeType: 'CHILD', childId: 'c1' },
    }));

    const service = new PolicySuggestionService({
      extractors: [new OverlayCoverageEvidenceExtractor(overlays)],
      detectorRegistry: new PatternDetectorRegistry(),
      evidenceRepository: evidenceRepo,
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      idGenerator: ids.gen,
    });

    // Should detect the same pattern but dedup against existing pending
    const suggestions = await service.generateSuggestions({ window: WINDOW });
    expect(suggestions).toHaveLength(0);

    // Only the original suggestion exists
    expect(suggestionRepo.suggestions).toHaveLength(1);
  });

  it('pending review bundles sorted deterministically with reversed repos', async () => {
    const suggestionRepo = new ReversedSuggestionRepo();
    const linkRepo = new ReversedLinkRepo();
    const evidenceRepo = new ReversedEvidenceRepo();

    await suggestionRepo.save(makePendingSuggestion({
      suggestionId: 'sug-b',
      confidenceScore: 0.7,
      suggestionType: 'MIN_BLOCK_LENGTH_ADJUSTMENT',
    }));
    await suggestionRepo.save(makePendingSuggestion({
      suggestionId: 'sug-a',
      confidenceScore: 0.95,
      suggestionType: 'SCHOOL_CLOSURE_COVERAGE_PREFERENCE',
    }));

    const reviewService = new PolicySuggestionReviewService({
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      evidenceRepository: evidenceRepo,
    });

    const bundles = await reviewService.getPendingReviewBundles('fam-1');

    // Sorted by confidence desc despite reversed repo
    expect(bundles).toHaveLength(2);
    expect(bundles[0].suggestionId).toBe('sug-a');
    expect(bundles[0].confidenceScore).toBe(0.95);
    expect(bundles[1].suggestionId).toBe('sug-b');
    expect(bundles[1].confidenceScore).toBe(0.7);
  });
});

// ═══════════════════════════════════════════════════════════════
// D. Stale/repeated resolution robustness
// ═══════════════════════════════════════════════════════════════

describe('Stale/repeated resolution robustness', () => {
  let suggestionRepo: InMemorySuggestionRepo;
  let policyRepo: InMemoryPolicyRuleRepo;
  let ids: ReturnType<typeof makeIdGenerator>;

  beforeEach(() => {
    suggestionRepo = new InMemorySuggestionRepo();
    policyRepo = new InMemoryPolicyRuleRepo();
    ids = makeIdGenerator();
  });

  function createWorkflow() {
    return new PolicySuggestionResolutionWorkflow({
      suggestionRepository: suggestionRepo,
      policyRuleRepository: policyRepo,
      idGenerator: ids.gen,
    });
  }

  it('accepting an already accepted suggestion fails cleanly', async () => {
    await suggestionRepo.save(makePendingSuggestion({ suggestionId: 'sug-1', status: 'ACCEPTED' }));

    await expect(
      createWorkflow().resolveSuggestion({
        suggestionId: 'sug-1',
        decision: 'ACCEPT',
        resolvedAt: '2026-03-28T10:00:00Z',
        resolvedBy: 'parent-p1',
      }),
    ).rejects.toThrow('not pending review');

    expect(policyRepo.rules).toHaveLength(0);
  });

  it('rejecting an already accepted suggestion fails cleanly', async () => {
    await suggestionRepo.save(makePendingSuggestion({ suggestionId: 'sug-1', status: 'ACCEPTED' }));

    await expect(
      createWorkflow().resolveSuggestion({
        suggestionId: 'sug-1',
        decision: 'REJECT',
        resolvedAt: '2026-03-28T10:00:00Z',
        resolvedBy: 'parent-p1',
      }),
    ).rejects.toThrow('not pending review');
  });

  it('accepting an already rejected suggestion fails cleanly', async () => {
    await suggestionRepo.save(makePendingSuggestion({ suggestionId: 'sug-1', status: 'REJECTED' }));

    await expect(
      createWorkflow().resolveSuggestion({
        suggestionId: 'sug-1',
        decision: 'ACCEPT',
        resolvedAt: '2026-03-28T10:00:00Z',
        resolvedBy: 'parent-p1',
      }),
    ).rejects.toThrow('not pending review');

    expect(policyRepo.rules).toHaveLength(0);
  });

  it('rejecting an already rejected suggestion fails cleanly', async () => {
    await suggestionRepo.save(makePendingSuggestion({ suggestionId: 'sug-1', status: 'REJECTED' }));

    await expect(
      createWorkflow().resolveSuggestion({
        suggestionId: 'sug-1',
        decision: 'REJECT',
        resolvedAt: '2026-03-28T10:00:00Z',
        resolvedBy: 'parent-p1',
      }),
    ).rejects.toThrow('not pending review');
  });

  it('resolving an EXPIRED suggestion fails cleanly', async () => {
    await suggestionRepo.save(makePendingSuggestion({ suggestionId: 'sug-1', status: 'EXPIRED' }));

    await expect(
      createWorkflow().resolveSuggestion({
        suggestionId: 'sug-1',
        decision: 'ACCEPT',
        resolvedAt: '2026-03-28T10:00:00Z',
        resolvedBy: 'parent-p1',
      }),
    ).rejects.toThrow('not pending review');

    expect(policyRepo.rules).toHaveLength(0);
  });

  it('nonexistent suggestion fails explicitly', async () => {
    await expect(
      createWorkflow().resolveSuggestion({
        suggestionId: 'nonexistent',
        decision: 'ACCEPT',
        resolvedAt: '2026-03-28T10:00:00Z',
        resolvedBy: 'parent-p1',
      }),
    ).rejects.toThrow('Suggestion not found');

    expect(policyRepo.rules).toHaveLength(0);
  });

  it('double accept — first succeeds, second fails on status check', async () => {
    await suggestionRepo.save(makePendingSuggestion({ suggestionId: 'sug-1' }));
    const workflow = createWorkflow();

    const result = await workflow.resolveSuggestion({
      suggestionId: 'sug-1',
      decision: 'ACCEPT',
      resolvedAt: '2026-03-28T10:00:00Z',
      resolvedBy: 'parent-p1',
    });
    expect(result.status).toBe('ACCEPTED');
    expect(policyRepo.rules).toHaveLength(1);

    await expect(
      workflow.resolveSuggestion({
        suggestionId: 'sug-1',
        decision: 'ACCEPT',
        resolvedAt: '2026-03-29T10:00:00Z',
        resolvedBy: 'parent-p2',
      }),
    ).rejects.toThrow('not pending review');

    // Still only one rule
    expect(policyRepo.rules).toHaveLength(1);
  });

  it('accept then reject — second call fails, original resolution intact', async () => {
    await suggestionRepo.save(makePendingSuggestion({ suggestionId: 'sug-1' }));
    const workflow = createWorkflow();

    await workflow.resolveSuggestion({
      suggestionId: 'sug-1',
      decision: 'ACCEPT',
      resolvedAt: '2026-03-28T10:00:00Z',
      resolvedBy: 'parent-p1',
    });

    await expect(
      workflow.resolveSuggestion({
        suggestionId: 'sug-1',
        decision: 'REJECT',
        resolvedAt: '2026-03-29T10:00:00Z',
        resolvedBy: 'parent-p2',
      }),
    ).rejects.toThrow('not pending review');

    const s = await suggestionRepo.findById('sug-1');
    expect(s!.status).toBe('ACCEPTED');
    expect(s!.resolvedBy).toBe('parent-p1');
    expect(policyRepo.rules).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// E. Corrupted or incomplete persisted-state handling
// ═══════════════════════════════════════════════════════════════

describe('Corrupted or incomplete persisted-state handling', () => {
  it('review bundle for suggestion with missing evidence — zero evidence count', async () => {
    const suggestionRepo = new InMemorySuggestionRepo();
    const linkRepo = new InMemoryLinkRepo();
    const evidenceRepo = new InMemoryEvidenceRepo();

    await suggestionRepo.save(makePendingSuggestion({ suggestionId: 'sug-orphan' }));
    // Links exist but evidence is missing
    await linkRepo.saveBatch([
      { id: 'link-1', suggestionId: 'sug-orphan', evidenceId: 'ev-gone-1', createdAt: '2026-03-25T10:00:00Z' },
      { id: 'link-2', suggestionId: 'sug-orphan', evidenceId: 'ev-gone-2', createdAt: '2026-03-25T10:00:00Z' },
    ]);

    const reviewService = new PolicySuggestionReviewService({
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      evidenceRepository: evidenceRepo,
    });

    const bundle = await reviewService.getReviewBundle('sug-orphan');

    // Permissive — does not throw, shows zero evidence
    expect(bundle.suggestionId).toBe('sug-orphan');
    expect(bundle.artifacts).toHaveLength(4);
    const countArtifact = bundle.artifacts.find(a => a.type === 'EVIDENCE_COUNT_SUMMARY')!;
    expect(countArtifact.data.totalEvidenceCount).toBe(0);
    expect(countArtifact.data.evidenceTypes).toEqual({});
  });

  it('review bundle for suggestion with partially available evidence', async () => {
    const suggestionRepo = new InMemorySuggestionRepo();
    const linkRepo = new InMemoryLinkRepo();
    const evidenceRepo = new InMemoryEvidenceRepo();

    await suggestionRepo.save(makePendingSuggestion({ suggestionId: 'sug-partial' }));
    await evidenceRepo.save({
      evidenceId: 'ev-exists', familyId: 'fam-1', evidenceType: 'OVERLAY_COVERAGE',
      date: '2026-03-05', data: {}, createdAt: '2026-03-05T00:00:00Z',
    });
    await linkRepo.saveBatch([
      { id: 'link-1', suggestionId: 'sug-partial', evidenceId: 'ev-exists', createdAt: '2026-03-25T10:00:00Z' },
      { id: 'link-2', suggestionId: 'sug-partial', evidenceId: 'ev-missing', createdAt: '2026-03-25T10:00:00Z' },
    ]);

    const reviewService = new PolicySuggestionReviewService({
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      evidenceRepository: evidenceRepo,
    });

    const bundle = await reviewService.getReviewBundle('sug-partial');

    // Only 1 of 2 linked evidence records found
    const countArtifact = bundle.artifacts.find(a => a.type === 'EVIDENCE_COUNT_SUMMARY')!;
    expect(countArtifact.data.totalEvidenceCount).toBe(1);
    expect(countArtifact.data.evidenceTypes).toEqual({ OVERLAY_COVERAGE: 1 });
  });

  it('review bundle request for nonexistent suggestion throws', async () => {
    const reviewService = new PolicySuggestionReviewService({
      suggestionRepository: new InMemorySuggestionRepo(),
      evidenceLinkRepository: new InMemoryLinkRepo(),
      evidenceRepository: new InMemoryEvidenceRepo(),
    });

    await expect(
      reviewService.getReviewBundle('sug-nonexistent'),
    ).rejects.toThrow('Suggestion not found');
  });

  it('suggestion with empty evidenceSummary produces valid review bundle', async () => {
    const suggestionRepo = new InMemorySuggestionRepo();
    await suggestionRepo.save(makePendingSuggestion({
      suggestionId: 'sug-empty',
      evidenceSummary: {
        occurrenceCount: 0,
        windowStart: '2026-03-01',
        windowEnd: '2026-03-31',
        representativeExamples: [],
      },
    }));

    const reviewService = new PolicySuggestionReviewService({
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: new InMemoryLinkRepo(),
      evidenceRepository: new InMemoryEvidenceRepo(),
    });

    const bundle = await reviewService.getReviewBundle('sug-empty');
    expect(bundle.artifacts).toHaveLength(4);
    expect(bundle.evidenceSummary.occurrenceCount).toBe(0);
    expect(bundle.evidenceSummary.representativeExamples).toEqual([]);

    const examplesArtifact = bundle.artifacts.find(a => a.type === 'REPRESENTATIVE_EXAMPLES')!;
    expect(examplesArtifact.data.examples).toEqual([]);
  });

  it('accepting suggestion with no scope defaults to FAMILY scope on rule', async () => {
    const suggestionRepo = new InMemorySuggestionRepo();
    const policyRepo = new InMemoryPolicyRuleRepo();

    await suggestionRepo.save(makePendingSuggestion({
      suggestionId: 'sug-noscope',
      proposedScope: undefined,
    }));

    const workflow = new PolicySuggestionResolutionWorkflow({
      suggestionRepository: suggestionRepo,
      policyRuleRepository: policyRepo,
      idGenerator: makeIdGenerator().gen,
    });

    const result = await workflow.resolveSuggestion({
      suggestionId: 'sug-noscope',
      decision: 'ACCEPT',
      resolvedAt: '2026-03-28T10:00:00Z',
      resolvedBy: 'parent-p1',
    });

    const rule = await policyRepo.findById(result.createdPolicyRuleId!);
    expect(rule!.scope).toEqual({ scopeType: 'FAMILY' });
  });
});
