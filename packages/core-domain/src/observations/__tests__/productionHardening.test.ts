import { describe, it, expect, beforeEach } from 'vitest';
import { PolicySuggestionService } from '../core/PolicySuggestionService';
import { PolicySuggestionResolutionWorkflow } from '../suggestions/PolicySuggestionResolutionWorkflow';
import { PolicySuggestionReviewService } from '../review/PolicySuggestionReviewService';
import { PatternDetectorRegistry } from '../detectors/PatternDetectorRegistry';
import { ExchangePatternEvidenceExtractor, ExchangeRecord } from '../evidence/ExchangePatternEvidenceExtractor';
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

// ═══════════════════════════════════════════════════════════════
// DB-like repos: return deep clones, never shared references
// These simulate real TypeORM/Prisma behavior where find methods
// return fresh detached objects, not references to stored data.
// ═══════════════════════════════════════════════════════════════

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

class DetachedEvidenceRepo implements IObservationEvidenceRepository {
  private store: ObservationEvidenceRecord[] = [];
  async save(r: ObservationEvidenceRecord) { this.store.push(deepClone(r)); }
  async saveBatch(rs: ObservationEvidenceRecord[]) { this.store.push(...rs.map(r => deepClone(r))); }
  async findByFamilyId(fid: string) { return deepClone(this.store.filter(r => r.familyId === fid)); }
  async findByWindow(w: BehaviorObservationWindow) {
    return deepClone(this.store.filter(r => r.familyId === w.familyId && r.date >= w.startDate && r.date <= w.endDate));
  }
  async findById(id: string) {
    const found = this.store.find(r => r.evidenceId === id);
    return found ? deepClone(found) : null;
  }
  async findByIds(ids: string[]) { return deepClone(this.store.filter(r => ids.includes(r.evidenceId))); }
  get records() { return this.store; }
}

class DetachedSuggestionRepo implements IPolicySuggestionRepository {
  private store: PolicySuggestion[] = [];
  async save(s: PolicySuggestion) { this.store.push(deepClone(s)); }
  async findById(id: string) {
    const found = this.store.find(s => s.suggestionId === id);
    return found ? deepClone(found) : null;
  }
  async findByFamilyId(fid: string) { return deepClone(this.store.filter(s => s.familyId === fid)); }
  async findPendingByFamilyId(fid: string) {
    return deepClone(this.store.filter(s => s.familyId === fid && s.status === 'PENDING_REVIEW'));
  }
  async update(s: PolicySuggestion) {
    const idx = this.store.findIndex(x => x.suggestionId === s.suggestionId);
    if (idx >= 0) this.store[idx] = deepClone(s);
  }
  get suggestions() { return this.store; }
}

class DetachedLinkRepo implements IPolicySuggestionEvidenceLinkRepository {
  private store: PolicySuggestionEvidenceLink[] = [];
  async save(l: PolicySuggestionEvidenceLink) { this.store.push(deepClone(l)); }
  async saveBatch(ls: PolicySuggestionEvidenceLink[]) { this.store.push(...ls.map(l => deepClone(l))); }
  async findBySuggestionId(sid: string) { return deepClone(this.store.filter(l => l.suggestionId === sid)); }
  async findByEvidenceId(eid: string) { return deepClone(this.store.filter(l => l.evidenceId === eid)); }
  get links() { return this.store; }
}

class DetachedPolicyRuleRepo implements IPolicyRuleRepository {
  private store: TypedPolicyRule[] = [];
  async findById(id: string) {
    const found = this.store.find(r => r.id === id);
    return found ? deepClone(found) : null;
  }
  async findByFamilyId(fid: string) { return deepClone(this.store.filter(r => r.familyId === fid)); }
  async findActiveByFamilyId(fid: string) { return deepClone(this.store.filter(r => r.familyId === fid && r.active)); }
  async findBySourceSuggestionId(sid: string) {
    const found = this.store.find(r => r.sourceSuggestionId === sid);
    return found ? deepClone(found) : null;
  }
  async save(r: TypedPolicyRule) { this.store.push(deepClone(r)); }
  async update(r: TypedPolicyRule) {
    const idx = this.store.findIndex(x => x.id === r.id);
    if (idx >= 0) this.store[idx] = deepClone(r);
  }
  async delete(id: string) { this.store = this.store.filter(r => r.id !== id); }
  get rules() { return this.store; }
}

// Repo that simulates DB update failure after rule save (detached semantics)
class DetachedFailOnUpdateSuggestionRepo extends DetachedSuggestionRepo {
  async update(_s: PolicySuggestion): Promise<void> {
    throw new Error('Simulated DB suggestion update failure');
  }
}

// ─── Shared test data ────────────────────────────────────────

const WINDOW: BehaviorObservationWindow = {
  familyId: 'fam-1',
  startDate: '2026-03-01',
  endDate: '2026-03-31',
};

function makeSundayExchanges(): ExchangeRecord[] {
  return [
    { exchangeId: 'e1', familyId: 'fam-1', date: '2026-03-01', childId: 'c1', fromParentId: 'p1', toParentId: 'p2', time: '09:00', location: 'School' },
    { exchangeId: 'e2', familyId: 'fam-1', date: '2026-03-08', childId: 'c1', fromParentId: 'p2', toParentId: 'p1', time: '09:00', location: 'School' },
    { exchangeId: 'e3', familyId: 'fam-1', date: '2026-03-15', childId: 'c1', fromParentId: 'p1', toParentId: 'p2', time: '09:00', location: 'School' },
    { exchangeId: 'e4', familyId: 'fam-1', date: '2026-03-22', childId: 'c1', fromParentId: 'p2', toParentId: 'p1', time: '09:00', location: 'School' },
  ];
}

const overlays: OverlayCoverageRecord[] = [
  { overlayId: 'o1', familyId: 'fam-1', date: '2026-03-05', childId: 'c1', assignedParentId: 'p1', disruptionType: 'SCHOOL_CLOSURE' },
  { overlayId: 'o2', familyId: 'fam-1', date: '2026-03-12', childId: 'c1', assignedParentId: 'p1', disruptionType: 'SCHOOL_CLOSURE' },
  { overlayId: 'o3', familyId: 'fam-1', date: '2026-03-19', childId: 'c1', assignedParentId: 'p1', disruptionType: 'SCHOOL_CLOSURE' },
  { overlayId: 'o4', familyId: 'fam-1', date: '2026-03-26', childId: 'c1', assignedParentId: 'p1', disruptionType: 'SCHOOL_CLOSURE' },
];


// ═══════════════════════════════════════════════════════════════
// A. Acceptance atomicity contract
//
// GUARANTEE: Idempotent acceptance via sourceSuggestionId.
// The resolution workflow performs two sequential writes:
//   1. Check for existing rule via findBySourceSuggestionId
//   2. If no rule: policyRepo.save(rule) with sourceSuggestionId
//   3. suggestionRepo.update(s) — marks suggestion ACCEPTED
//
// If step 2 succeeds and step 3 fails:
//   - An orphaned active policy rule exists (with sourceSuggestionId set)
//   - Suggestion remains PENDING_REVIEW in a real DB
//   - On retry: step 1 finds the existing rule, skips step 2
//   - No duplicate rules are created
//
// If step 2 fails:
//   - Suggestion is clean (no mutation happened yet)
//   - No rule created
//
// REMAINING: Acceptance is still not atomic. An orphaned rule can exist
// temporarily until the retry succeeds. But duplicate rules are prevented.
// ═══════════════════════════════════════════════════════════════

describe('A. Acceptance atomicity — DB-like detached repos', () => {
  let ids: ReturnType<typeof makeIdGenerator>;

  beforeEach(() => {
    ids = makeIdGenerator();
  });

  it('successful acceptance: rule + suggestion update both persist (detached)', async () => {
    const suggestionRepo = new DetachedSuggestionRepo();
    const policyRepo = new DetachedPolicyRuleRepo();

    await suggestionRepo.save(makePendingSuggestion({ suggestionId: 'sug-1' }));

    const workflow = new PolicySuggestionResolutionWorkflow({
      suggestionRepository: suggestionRepo,
      policyRuleRepository: policyRepo,
      idGenerator: ids.gen,
    });

    const result = await workflow.resolveSuggestion({
      suggestionId: 'sug-1',
      decision: 'ACCEPT',
      resolvedAt: '2026-03-28T10:00:00Z',
      resolvedBy: 'parent-p1',
    });

    expect(result.status).toBe('ACCEPTED');
    expect(result.createdPolicyRuleId).toBeDefined();

    // Rule persisted with sourceSuggestionId
    const rule = await policyRepo.findById(result.createdPolicyRuleId!);
    expect(rule).not.toBeNull();
    expect(rule!.active).toBe(true);
    expect(rule!.sourceSuggestionId).toBe('sug-1');

    // Rule retrievable via sourceSuggestionId
    const bySource = await policyRepo.findBySourceSuggestionId('sug-1');
    expect(bySource).not.toBeNull();
    expect(bySource!.id).toBe(result.createdPolicyRuleId);

    // Suggestion updated
    const s = await suggestionRepo.findById('sug-1');
    expect(s!.status).toBe('ACCEPTED');
    expect(s!.resolvedAt).toBe('2026-03-28T10:00:00Z');
    expect(s!.resolvedBy).toBe('parent-p1');
  });

  it('update failure after rule save — rule persists with sourceSuggestionId, suggestion stays PENDING', async () => {
    // The acceptance flow is still non-atomic (rule save before suggestion update).
    // But now the rule carries sourceSuggestionId, enabling idempotent retry.
    const suggestionRepo = new DetachedFailOnUpdateSuggestionRepo();
    const policyRepo = new DetachedPolicyRuleRepo();

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
    ).rejects.toThrow('Simulated DB suggestion update failure');

    // Rule was saved BEFORE the update call — orphaned rule
    expect(policyRepo.rules).toHaveLength(1);
    expect(policyRepo.rules[0].active).toBe(true);
    // Rule carries sourceSuggestionId for idempotent retry
    expect(policyRepo.rules[0].sourceSuggestionId).toBe('sug-1');

    // DB-like behavior: suggestion remains PENDING_REVIEW
    const s = await suggestionRepo.findById('sug-1');
    expect(s!.status).toBe('PENDING_REVIEW');
  });

  it('IDEMPOTENT: retry after partial failure reuses existing rule, no duplicates', async () => {
    // After the fix: retry detects the existing rule via sourceSuggestionId
    // and reuses it instead of creating a duplicate.
    let updateCallCount = 0;
    const suggestionRepo = new DetachedSuggestionRepo();
    const originalUpdate = suggestionRepo.update.bind(suggestionRepo);
    suggestionRepo.update = async (s: PolicySuggestion) => {
      updateCallCount++;
      if (updateCallCount === 1) {
        throw new Error('Transient DB failure');
      }
      return originalUpdate(s);
    };
    const policyRepo = new DetachedPolicyRuleRepo();

    await suggestionRepo.save(makePendingSuggestion({ suggestionId: 'sug-1' }));

    const workflow = new PolicySuggestionResolutionWorkflow({
      suggestionRepository: suggestionRepo,
      policyRuleRepository: policyRepo,
      idGenerator: ids.gen,
    });

    // First attempt: rule saved, suggestion update fails
    await expect(
      workflow.resolveSuggestion({
        suggestionId: 'sug-1',
        decision: 'ACCEPT',
        resolvedAt: '2026-03-28T10:00:00Z',
        resolvedBy: 'parent-p1',
      }),
    ).rejects.toThrow('Transient DB failure');

    // One orphaned rule with sourceSuggestionId
    expect(policyRepo.rules).toHaveLength(1);
    const orphanedRuleId = policyRepo.rules[0].id;
    expect(policyRepo.rules[0].sourceSuggestionId).toBe('sug-1');

    // Suggestion still PENDING
    const s = await suggestionRepo.findById('sug-1');
    expect(s!.status).toBe('PENDING_REVIEW');

    // Retry: succeeds, reuses existing rule
    const result = await workflow.resolveSuggestion({
      suggestionId: 'sug-1',
      decision: 'ACCEPT',
      resolvedAt: '2026-03-28T11:00:00Z',
      resolvedBy: 'parent-p1',
    });

    expect(result.status).toBe('ACCEPTED');
    // Still only ONE rule — idempotent
    expect(policyRepo.rules).toHaveLength(1);
    // Same rule reused
    expect(result.createdPolicyRuleId).toBe(orphanedRuleId);

    // Suggestion now updated
    const updated = await suggestionRepo.findById('sug-1');
    expect(updated!.status).toBe('ACCEPTED');
  });

  it('successful rejection under detached semantics', async () => {
    const suggestionRepo = new DetachedSuggestionRepo();
    const policyRepo = new DetachedPolicyRuleRepo();

    await suggestionRepo.save(makePendingSuggestion({ suggestionId: 'sug-1' }));

    const workflow = new PolicySuggestionResolutionWorkflow({
      suggestionRepository: suggestionRepo,
      policyRuleRepository: policyRepo,
      idGenerator: ids.gen,
    });

    const result = await workflow.resolveSuggestion({
      suggestionId: 'sug-1',
      decision: 'REJECT',
      resolvedAt: '2026-03-28T10:00:00Z',
      resolvedBy: 'parent-p1',
    });

    expect(result.status).toBe('REJECTED');
    expect(policyRepo.rules).toHaveLength(0);

    const s = await suggestionRepo.findById('sug-1');
    expect(s!.status).toBe('REJECTED');
    expect(s!.resolvedAt).toBe('2026-03-28T10:00:00Z');
  });

  it('reject update failure under detached semantics — suggestion stays PENDING', async () => {
    const suggestionRepo = new DetachedFailOnUpdateSuggestionRepo();
    const policyRepo = new DetachedPolicyRuleRepo();

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
    ).rejects.toThrow('Simulated DB suggestion update failure');

    // No rule on reject path
    expect(policyRepo.rules).toHaveLength(0);

    // DB-like: suggestion stays PENDING (mutation not persisted)
    const s = await suggestionRepo.findById('sug-1');
    expect(s!.status).toBe('PENDING_REVIEW');
  });
});


// ═══════════════════════════════════════════════════════════════
// B. Generation idempotency contract
//
// CURRENT GUARANTEE: None. Generation is NOT idempotent.
//
// Each call to generateSuggestions():
//   - Always persists evidence via saveBatch (no dedup on evidence)
//   - Always persists links via saveBatch (no dedup on links)
//   - Deduplicates suggestions only against PENDING_REVIEW
//
// Retry semantics:
//   - If evidence saved but suggestion save fails:
//     retry will save evidence AGAIN (duplicated)
//   - If suggestion saved but link save fails:
//     retry will skip the suggestion (dedup) but save evidence again
//     the orphaned linkless suggestion stays
// ═══════════════════════════════════════════════════════════════

describe('B. Generation idempotency — detached repos', () => {
  let ids: ReturnType<typeof makeIdGenerator>;

  beforeEach(() => {
    ids = makeIdGenerator();
  });

  it('identical runs duplicate evidence but not suggestions', async () => {
    const evidenceRepo = new DetachedEvidenceRepo();
    const suggestionRepo = new DetachedSuggestionRepo();
    const linkRepo = new DetachedLinkRepo();

    function makeService() {
      return new PolicySuggestionService({
        extractors: [new ExchangePatternEvidenceExtractor(makeSundayExchanges())],
        detectorRegistry: new PatternDetectorRegistry(),
        evidenceRepository: evidenceRepo,
        suggestionRepository: suggestionRepo,
        evidenceLinkRepository: linkRepo,
        idGenerator: ids.gen,
      });
    }

    // Run 1
    const s1 = await makeService().generateSuggestions({ window: WINDOW });
    expect(s1.length).toBeGreaterThan(0);
    const evidenceAfter1 = evidenceRepo.records.length;
    const suggestionsAfter1 = suggestionRepo.suggestions.length;
    const linksAfter1 = linkRepo.links.length;

    // Run 2 (identical input)
    const s2 = await makeService().generateSuggestions({ window: WINDOW });

    // Suggestions deduplicated — none new
    expect(s2).toHaveLength(0);

    // Evidence doubled — no dedup on evidence
    expect(evidenceRepo.records.length).toBe(evidenceAfter1 * 2);

    // Links unchanged — no new suggestions, so no new links
    expect(linkRepo.links.length).toBe(linksAfter1);

    // Suggestions unchanged
    expect(suggestionRepo.suggestions.length).toBe(suggestionsAfter1);
  });

  it('retry after partial failure (suggestion save fails) duplicates evidence', async () => {
    const evidenceRepo = new DetachedEvidenceRepo();
    const linkRepo = new DetachedLinkRepo();
    let saveCallCount = 0;

    // Suggestion repo that fails on first save, succeeds on retry
    const suggestionRepo = new DetachedSuggestionRepo();
    const originalSave = suggestionRepo.save.bind(suggestionRepo);
    suggestionRepo.save = async (s: PolicySuggestion) => {
      saveCallCount++;
      if (saveCallCount === 1) {
        throw new Error('Transient save failure');
      }
      return originalSave(s);
    };

    function makeService() {
      return new PolicySuggestionService({
        extractors: [new OverlayCoverageEvidenceExtractor(overlays)],
        detectorRegistry: new PatternDetectorRegistry(),
        evidenceRepository: evidenceRepo,
        suggestionRepository: suggestionRepo,
        evidenceLinkRepository: linkRepo,
        idGenerator: ids.gen,
      });
    }

    // First attempt: evidence saved (4 records), then suggestion save fails
    await expect(makeService().generateSuggestions({ window: WINDOW }))
      .rejects.toThrow('Transient save failure');

    expect(evidenceRepo.records.length).toBe(4);
    expect(suggestionRepo.suggestions.length).toBe(0);

    // Retry: evidence saved AGAIN (now 8 records), suggestion succeeds
    const result = await makeService().generateSuggestions({ window: WINDOW });
    expect(result.length).toBeGreaterThan(0);

    // Evidence is duplicated — 8 records, not 4
    expect(evidenceRepo.records.length).toBe(8);

    // Suggestion exists once
    expect(suggestionRepo.suggestions.length).toBe(1);
  });

  it('retry after link save failure — orphaned suggestion persists, evidence doubles', async () => {
    const evidenceRepo = new DetachedEvidenceRepo();
    const suggestionRepo = new DetachedSuggestionRepo();
    let linkSaveCallCount = 0;

    const linkRepo = new DetachedLinkRepo();
    const originalSaveBatch = linkRepo.saveBatch.bind(linkRepo);
    linkRepo.saveBatch = async (ls: PolicySuggestionEvidenceLink[]) => {
      linkSaveCallCount++;
      if (linkSaveCallCount === 1) {
        throw new Error('Transient link save failure');
      }
      return originalSaveBatch(ls);
    };

    function makeService() {
      return new PolicySuggestionService({
        extractors: [new OverlayCoverageEvidenceExtractor(overlays)],
        detectorRegistry: new PatternDetectorRegistry(),
        evidenceRepository: evidenceRepo,
        suggestionRepository: suggestionRepo,
        evidenceLinkRepository: linkRepo,
        idGenerator: ids.gen,
      });
    }

    // First attempt: evidence (4) + suggestion (1) saved, then link save fails
    await expect(makeService().generateSuggestions({ window: WINDOW }))
      .rejects.toThrow('Transient link save failure');

    expect(evidenceRepo.records.length).toBe(4);
    expect(suggestionRepo.suggestions.length).toBe(1);
    expect(linkRepo.links.length).toBe(0);

    // Retry: evidence doubles (8), suggestion deduped (still 1), links NOT created
    // because the suggestion is still PENDING and dedup blocks the new candidate
    const result = await makeService().generateSuggestions({ window: WINDOW });
    expect(result).toHaveLength(0);

    expect(evidenceRepo.records.length).toBe(8);
    expect(suggestionRepo.suggestions.length).toBe(1);
    // Links still zero — the orphaned suggestion has no links, and
    // dedup prevented re-creating it, so links were never retried
    expect(linkRepo.links.length).toBe(0);

    // PRODUCTION RISK: suggestion exists but has no evidence links.
    // Review bundle will show 0 evidence. Linkless suggestion is orphaned.
  });
});


// ═══════════════════════════════════════════════════════════════
// C. Active-rule suppression contract
//
// CURRENT GUARANTEE: None. Active rules do NOT suppress suggestions.
//
// After a suggestion is accepted and a policy rule created:
//   - The suggestion status becomes ACCEPTED
//   - Deduplication only checks PENDING_REVIEW suggestions
//   - A new generation run will produce a new PENDING_REVIEW suggestion
//     for the same pattern (because the accepted one is not in the
//     dedup filter)
//   - No check is made against active policy rules
//
// This is by design: patterns may evolve, and re-suggestion
// allows the system to update parameters. But it means users
// may see repeated suggestions for already-accepted rules.
// ═══════════════════════════════════════════════════════════════

describe('C. Active-rule suppression — detached repos', () => {
  let ids: ReturnType<typeof makeIdGenerator>;

  beforeEach(() => {
    ids = makeIdGenerator();
  });

  it('accepted rule does NOT suppress equivalent new suggestions', async () => {
    const evidenceRepo = new DetachedEvidenceRepo();
    const suggestionRepo = new DetachedSuggestionRepo();
    const linkRepo = new DetachedLinkRepo();
    const policyRepo = new DetachedPolicyRuleRepo();

    function makeService() {
      return new PolicySuggestionService({
        extractors: [new OverlayCoverageEvidenceExtractor(overlays)],
        detectorRegistry: new PatternDetectorRegistry(),
        evidenceRepository: evidenceRepo,
        suggestionRepository: suggestionRepo,
        evidenceLinkRepository: linkRepo,
        idGenerator: ids.gen,
      });
    }

    // Generate, accept
    const s1 = await makeService().generateSuggestions({ window: WINDOW });
    expect(s1.length).toBeGreaterThan(0);

    const workflow = new PolicySuggestionResolutionWorkflow({
      suggestionRepository: suggestionRepo,
      policyRuleRepository: policyRepo,
      idGenerator: ids.gen,
    });

    await workflow.resolveSuggestion({
      suggestionId: s1[0].suggestionId,
      decision: 'ACCEPT',
      resolvedAt: '2026-03-28T10:00:00Z',
      resolvedBy: 'parent-p1',
    });

    // Verify rule created
    expect(policyRepo.rules).toHaveLength(1);
    expect(policyRepo.rules[0].active).toBe(true);

    // Verify suggestion is ACCEPTED (no longer PENDING)
    const accepted = await suggestionRepo.findById(s1[0].suggestionId);
    expect(accepted!.status).toBe('ACCEPTED');

    // Re-run generation — produces a NEW pending suggestion
    // because dedup only checks PENDING_REVIEW, not ACCEPTED
    const s2 = await makeService().generateSuggestions({ window: WINDOW });
    expect(s2.length).toBeGreaterThan(0);

    // Now there are two suggestions: one ACCEPTED, one new PENDING
    const allSuggestions = suggestionRepo.suggestions;
    const pending = allSuggestions.filter(s => s.status === 'PENDING_REVIEW');
    const acceptedAll = allSuggestions.filter(s => s.status === 'ACCEPTED');
    expect(pending.length).toBeGreaterThan(0);
    expect(acceptedAll).toHaveLength(1);

    // DOCUMENTED: active rules do not suppress future suggestions.
    // This is by design — the system intentionally allows re-evaluation.
  });

  it('rejected suggestion does NOT suppress equivalent new suggestions', async () => {
    const evidenceRepo = new DetachedEvidenceRepo();
    const suggestionRepo = new DetachedSuggestionRepo();
    const linkRepo = new DetachedLinkRepo();
    const policyRepo = new DetachedPolicyRuleRepo();

    function makeService() {
      return new PolicySuggestionService({
        extractors: [new OverlayCoverageEvidenceExtractor(overlays)],
        detectorRegistry: new PatternDetectorRegistry(),
        evidenceRepository: evidenceRepo,
        suggestionRepository: suggestionRepo,
        evidenceLinkRepository: linkRepo,
        idGenerator: ids.gen,
      });
    }

    const s1 = await makeService().generateSuggestions({ window: WINDOW });
    expect(s1.length).toBeGreaterThan(0);

    const workflow = new PolicySuggestionResolutionWorkflow({
      suggestionRepository: suggestionRepo,
      policyRuleRepository: policyRepo,
      idGenerator: ids.gen,
    });

    await workflow.resolveSuggestion({
      suggestionId: s1[0].suggestionId,
      decision: 'REJECT',
      resolvedAt: '2026-03-28T10:00:00Z',
      resolvedBy: 'parent-p1',
    });

    // Re-run: new pending suggestion generated
    const s2 = await makeService().generateSuggestions({ window: WINDOW });
    expect(s2.length).toBeGreaterThan(0);

    const pending = suggestionRepo.suggestions.filter(s => s.status === 'PENDING_REVIEW');
    expect(pending.length).toBeGreaterThan(0);
  });

  it('only PENDING_REVIEW suggestions suppress duplicates', async () => {
    const evidenceRepo = new DetachedEvidenceRepo();
    const suggestionRepo = new DetachedSuggestionRepo();
    const linkRepo = new DetachedLinkRepo();

    function makeService() {
      return new PolicySuggestionService({
        extractors: [new OverlayCoverageEvidenceExtractor(overlays)],
        detectorRegistry: new PatternDetectorRegistry(),
        evidenceRepository: evidenceRepo,
        suggestionRepository: suggestionRepo,
        evidenceLinkRepository: linkRepo,
        idGenerator: ids.gen,
      });
    }

    // First run: creates pending suggestions
    const s1 = await makeService().generateSuggestions({ window: WINDOW });
    expect(s1.length).toBeGreaterThan(0);

    // Second run: deduped against pending — nothing new
    const s2 = await makeService().generateSuggestions({ window: WINDOW });
    expect(s2).toHaveLength(0);

    // No new suggestions
    expect(suggestionRepo.suggestions.length).toBe(s1.length);
  });
});


// ═══════════════════════════════════════════════════════════════
// D. Repository object semantics — shared ref vs detached
//
// CURRENT CONTRACT:
//   - Repository interfaces do not specify object identity semantics
//   - In-memory repos return shared references (mutation leaks)
//   - Real DB repos will return detached/fresh copies
//   - Service correctness MUST NOT depend on shared-object mutation
//
// The resolution workflow mutates the suggestion object directly
// (lines 96-98 and 135-137 in the source) before calling update().
// Under shared-ref repos, this mutates the stored object even if
// update() is never called or throws.
// Under detached repos, the mutation only affects the local copy.
// ═══════════════════════════════════════════════════════════════

describe('D. Service correctness under detached object semantics', () => {
  let ids: ReturnType<typeof makeIdGenerator>;

  beforeEach(() => {
    ids = makeIdGenerator();
  });

  it('generation pipeline works correctly with detached repos', async () => {
    const evidenceRepo = new DetachedEvidenceRepo();
    const suggestionRepo = new DetachedSuggestionRepo();
    const linkRepo = new DetachedLinkRepo();

    const service = new PolicySuggestionService({
      extractors: [new ExchangePatternEvidenceExtractor(makeSundayExchanges())],
      detectorRegistry: new PatternDetectorRegistry(),
      evidenceRepository: evidenceRepo,
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      idGenerator: ids.gen,
    });

    const suggestions = await service.generateSuggestions({ window: WINDOW });
    expect(suggestions.length).toBeGreaterThan(0);

    // Evidence, suggestions, and links all persisted correctly
    expect(evidenceRepo.records.length).toBeGreaterThan(0);
    expect(suggestionRepo.suggestions.length).toBe(suggestions.length);
    expect(linkRepo.links.length).toBeGreaterThan(0);

    // Each suggestion has corresponding links
    for (const s of suggestions) {
      const links = await linkRepo.findBySuggestionId(s.suggestionId);
      expect(links.length).toBeGreaterThan(0);
    }
  });

  it('deduplication works with detached repos (no shared-ref dependency)', async () => {
    const evidenceRepo = new DetachedEvidenceRepo();
    const suggestionRepo = new DetachedSuggestionRepo();
    const linkRepo = new DetachedLinkRepo();

    function makeService() {
      return new PolicySuggestionService({
        extractors: [new ExchangePatternEvidenceExtractor(makeSundayExchanges())],
        detectorRegistry: new PatternDetectorRegistry(),
        evidenceRepository: evidenceRepo,
        suggestionRepository: suggestionRepo,
        evidenceLinkRepository: linkRepo,
        idGenerator: ids.gen,
      });
    }

    const s1 = await makeService().generateSuggestions({ window: WINDOW });
    expect(s1.length).toBeGreaterThan(0);

    // Second run: dedup must work even though findPendingByFamilyId
    // returns detached copies (not the same objects as stored)
    const s2 = await makeService().generateSuggestions({ window: WINDOW });
    expect(s2).toHaveLength(0);
  });

  it('review service works correctly with detached repos', async () => {
    const evidenceRepo = new DetachedEvidenceRepo();
    const suggestionRepo = new DetachedSuggestionRepo();
    const linkRepo = new DetachedLinkRepo();

    const service = new PolicySuggestionService({
      extractors: [new ExchangePatternEvidenceExtractor(makeSundayExchanges())],
      detectorRegistry: new PatternDetectorRegistry(),
      evidenceRepository: evidenceRepo,
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      idGenerator: ids.gen,
    });

    const suggestions = await service.generateSuggestions({ window: WINDOW });

    const reviewService = new PolicySuggestionReviewService({
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      evidenceRepository: evidenceRepo,
    });

    for (const s of suggestions) {
      const bundle = await reviewService.getReviewBundle(s.suggestionId);
      expect(bundle.suggestionId).toBe(s.suggestionId);
      expect(bundle.artifacts).toHaveLength(4);

      const countArtifact = bundle.artifacts.find(a => a.type === 'EVIDENCE_COUNT_SUMMARY')!;
      expect(countArtifact.data.totalEvidenceCount).toBeGreaterThan(0);
    }
  });

  it('resolution workflow works correctly with detached repos', async () => {
    const evidenceRepo = new DetachedEvidenceRepo();
    const suggestionRepo = new DetachedSuggestionRepo();
    const linkRepo = new DetachedLinkRepo();
    const policyRepo = new DetachedPolicyRuleRepo();

    const service = new PolicySuggestionService({
      extractors: [new OverlayCoverageEvidenceExtractor(overlays)],
      detectorRegistry: new PatternDetectorRegistry(),
      evidenceRepository: evidenceRepo,
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      idGenerator: ids.gen,
    });

    const suggestions = await service.generateSuggestions({ window: WINDOW });
    expect(suggestions.length).toBeGreaterThan(0);

    const workflow = new PolicySuggestionResolutionWorkflow({
      suggestionRepository: suggestionRepo,
      policyRuleRepository: policyRepo,
      idGenerator: ids.gen,
    });

    const result = await workflow.resolveSuggestion({
      suggestionId: suggestions[0].suggestionId,
      decision: 'ACCEPT',
      resolvedAt: '2026-03-28T10:00:00Z',
      resolvedBy: 'parent-p1',
    });

    expect(result.status).toBe('ACCEPTED');

    // Under detached semantics, the update() call wrote the status change
    const s = await suggestionRepo.findById(suggestions[0].suggestionId);
    expect(s!.status).toBe('ACCEPTED');

    // Rule created and retrievable
    const rule = await policyRepo.findById(result.createdPolicyRuleId!);
    expect(rule!.active).toBe(true);
    expect(rule!.familyId).toBe('fam-1');
  });

  it('shared-ref mutation leak documented: in-memory update failure mutates stored object', async () => {
    // This test documents the DIFFERENCE between in-memory and DB repos.
    // In-memory: findById returns the stored reference. Mutation leaks.
    // Detached: findById returns a copy. Mutation is local only.

    // In-memory behavior:
    const inMemRepo = new InMemorySuggestionRepo();
    await inMemRepo.save(makePendingSuggestion({ suggestionId: 'sug-mem' }));
    const memRef = await inMemRepo.findById('sug-mem');
    memRef!.status = 'ACCEPTED'; // Direct mutation
    // Mutation leaked to store — no update() needed
    const memStored = await inMemRepo.findById('sug-mem');
    expect(memStored!.status).toBe('ACCEPTED');

    // Detached behavior:
    const detachedRepo = new DetachedSuggestionRepo();
    await detachedRepo.save(makePendingSuggestion({ suggestionId: 'sug-det' }));
    const detRef = await detachedRepo.findById('sug-det');
    detRef!.status = 'ACCEPTED'; // Local mutation only
    // Store is unaffected — update() required
    const detStored = await detachedRepo.findById('sug-det');
    expect(detStored!.status).toBe('PENDING_REVIEW');

    // This demonstrates that service correctness MUST call update()
    // to persist changes. The current resolution workflow does call
    // update(), so it works correctly under both semantics — as long
    // as update() does not throw.
  });
});


// ═══════════════════════════════════════════════════════════════
// E. Ordering contract
//
// CURRENT GUARANTEE:
//   - Service layer ALWAYS sorts results deterministically
//   - Evidence: date asc, evidenceId asc
//   - Suggestions: confidenceScore desc, suggestionType asc, suggestionId asc
//   - Review bundles: same as suggestions
//   - Repos are NOT required to return sorted results
//   - Future DB implementations may return any order
//
// The sort happens in:
//   - PolicySuggestionService.generateSuggestions (evidence + return)
//   - PolicySuggestionService.getPendingSuggestions (suggestions)
//   - PolicySuggestionReviewService.getReviewBundle (evidence)
//   - PolicySuggestionReviewService.getPendingReviewBundles (suggestions)
// ═══════════════════════════════════════════════════════════════

describe('E. Ordering contracts — detached repos with shuffled data', () => {
  let ids: ReturnType<typeof makeIdGenerator>;

  beforeEach(() => {
    ids = makeIdGenerator();
  });

  it('generation output is deterministic regardless of extractor order', async () => {
    const evidenceRepo = new DetachedEvidenceRepo();
    const suggestionRepo1 = new DetachedSuggestionRepo();
    const linkRepo1 = new DetachedLinkRepo();
    const suggestionRepo2 = new DetachedSuggestionRepo();
    const linkRepo2 = new DetachedLinkRepo();

    // Run with exchanges in original order
    ids.reset();
    const service1 = new PolicySuggestionService({
      extractors: [new ExchangePatternEvidenceExtractor(makeSundayExchanges())],
      detectorRegistry: new PatternDetectorRegistry(),
      evidenceRepository: new DetachedEvidenceRepo(),
      suggestionRepository: suggestionRepo1,
      evidenceLinkRepository: linkRepo1,
      idGenerator: ids.gen,
    });
    const s1 = await service1.generateSuggestions({ window: WINDOW });

    // Run with exchanges in reverse order
    ids.reset();
    const reversedExchanges = [...makeSundayExchanges()].reverse();
    const service2 = new PolicySuggestionService({
      extractors: [new ExchangePatternEvidenceExtractor(reversedExchanges)],
      detectorRegistry: new PatternDetectorRegistry(),
      evidenceRepository: new DetachedEvidenceRepo(),
      suggestionRepository: suggestionRepo2,
      evidenceLinkRepository: linkRepo2,
      idGenerator: ids.gen,
    });
    const s2 = await service2.generateSuggestions({ window: WINDOW });

    // Same number, same types, same confidence, same order
    expect(s1.length).toBe(s2.length);
    expect(s1.map(s => s.suggestionType)).toEqual(s2.map(s => s.suggestionType));
    expect(s1.map(s => s.confidenceScore)).toEqual(s2.map(s => s.confidenceScore));
  });

  it('getPendingSuggestions sorts deterministically with detached repos', async () => {
    const suggestionRepo = new DetachedSuggestionRepo();

    // Insert in non-sorted order
    await suggestionRepo.save(makePendingSuggestion({
      suggestionId: 'sug-low',
      confidenceScore: 0.5,
      suggestionType: 'MIN_BLOCK_LENGTH_ADJUSTMENT',
    }));
    await suggestionRepo.save(makePendingSuggestion({
      suggestionId: 'sug-high',
      confidenceScore: 0.95,
      suggestionType: 'SCHOOL_CLOSURE_COVERAGE_PREFERENCE',
    }));
    await suggestionRepo.save(makePendingSuggestion({
      suggestionId: 'sug-mid',
      confidenceScore: 0.75,
      suggestionType: 'PREFERRED_EXCHANGE_LOCATION',
    }));

    const service = new PolicySuggestionService({
      extractors: [],
      detectorRegistry: new PatternDetectorRegistry([]),
      evidenceRepository: new DetachedEvidenceRepo(),
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: new DetachedLinkRepo(),
      idGenerator: ids.gen,
    });

    const pending = await service.getPendingSuggestions({ familyId: 'fam-1' });

    expect(pending).toHaveLength(3);
    // Sorted by confidence desc
    expect(pending[0].confidenceScore).toBe(0.95);
    expect(pending[1].confidenceScore).toBe(0.75);
    expect(pending[2].confidenceScore).toBe(0.5);
  });

  it('review bundle evidence sorted deterministically with detached repos', async () => {
    const evidenceRepo = new DetachedEvidenceRepo();
    const suggestionRepo = new DetachedSuggestionRepo();
    const linkRepo = new DetachedLinkRepo();

    // Save evidence in reverse chronological order
    await evidenceRepo.saveBatch([
      { evidenceId: 'ev-3', familyId: 'fam-1', evidenceType: 'OVERLAY_COVERAGE', date: '2026-03-19', data: { val: 3 }, createdAt: '2026-03-19T00:00:00Z' },
      { evidenceId: 'ev-1', familyId: 'fam-1', evidenceType: 'OVERLAY_COVERAGE', date: '2026-03-05', data: { val: 1 }, createdAt: '2026-03-05T00:00:00Z' },
      { evidenceId: 'ev-2', familyId: 'fam-1', evidenceType: 'OVERLAY_COVERAGE', date: '2026-03-12', data: { val: 2 }, createdAt: '2026-03-12T00:00:00Z' },
    ]);

    await suggestionRepo.save(makePendingSuggestion({ suggestionId: 'sug-1' }));
    await linkRepo.saveBatch([
      { id: 'link-3', suggestionId: 'sug-1', evidenceId: 'ev-3', createdAt: '2026-03-25T10:00:00Z' },
      { id: 'link-1', suggestionId: 'sug-1', evidenceId: 'ev-1', createdAt: '2026-03-25T10:00:00Z' },
      { id: 'link-2', suggestionId: 'sug-1', evidenceId: 'ev-2', createdAt: '2026-03-25T10:00:00Z' },
    ]);

    const reviewService = new PolicySuggestionReviewService({
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      evidenceRepository: evidenceRepo,
    });

    const bundle = await reviewService.getReviewBundle('sug-1');

    // Evidence count correct
    const countArtifact = bundle.artifacts.find(a => a.type === 'EVIDENCE_COUNT_SUMMARY')!;
    expect(countArtifact.data.totalEvidenceCount).toBe(3);

    // Multiple calls return identical results (deterministic)
    const bundle2 = await reviewService.getReviewBundle('sug-1');
    expect(bundle.artifacts).toEqual(bundle2.artifacts);
  });
});
