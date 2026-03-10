import { describe, it, expect, beforeEach } from 'vitest';
import { PolicySuggestionService } from '../core/PolicySuggestionService';
import { PolicySuggestionResolutionWorkflow } from '../suggestions/PolicySuggestionResolutionWorkflow';
import { PolicySuggestionReviewService } from '../review/PolicySuggestionReviewService';
import { PatternDetectorRegistry } from '../detectors/PatternDetectorRegistry';
import { ExchangePatternEvidenceExtractor, ExchangeRecord } from '../evidence/ExchangePatternEvidenceExtractor';
import { OverlayCoverageEvidenceExtractor, OverlayCoverageRecord } from '../evidence/OverlayCoverageEvidenceExtractor';
import { AcceptedProposalEvidenceExtractor, AcceptedProposalRecord } from '../evidence/AcceptedProposalEvidenceExtractor';
import { ActivityResponsibilityEvidenceExtractor, ActivityRecord } from '../evidence/ActivityResponsibilityEvidenceExtractor';
import { BehaviorObservationWindow } from '../types';
import {
  InMemoryEvidenceRepo,
  InMemorySuggestionRepo,
  InMemoryLinkRepo,
  InMemoryPolicyRuleRepo,
  makeIdGenerator,
} from './helpers';

// ─── Shared setup ────────────────────────────────────────────

const WINDOW: BehaviorObservationWindow = {
  familyId: 'fam-1',
  startDate: '2026-03-01',
  endDate: '2026-03-31',
};

let evidenceRepo: InMemoryEvidenceRepo;
let suggestionRepo: InMemorySuggestionRepo;
let linkRepo: InMemoryLinkRepo;
let policyRepo: InMemoryPolicyRuleRepo;
let ids: ReturnType<typeof makeIdGenerator>;

beforeEach(() => {
  evidenceRepo = new InMemoryEvidenceRepo();
  suggestionRepo = new InMemorySuggestionRepo();
  linkRepo = new InMemoryLinkRepo();
  policyRepo = new InMemoryPolicyRuleRepo();
  ids = makeIdGenerator();
});

// ═══════════════════════════════════════════════════════════════
// Fixture A — Deduplication across repeated realistic runs
// ═══════════════════════════════════════════════════════════════

describe('Fixture Step4-A — deduplication across repeated runs (school-closure)', () => {
  const overlays: OverlayCoverageRecord[] = [
    { overlayId: 'o1', familyId: 'fam-1', date: '2026-03-05', childId: 'c1', assignedParentId: 'p1', disruptionType: 'SCHOOL_CLOSURE' },
    { overlayId: 'o2', familyId: 'fam-1', date: '2026-03-12', childId: 'c1', assignedParentId: 'p1', disruptionType: 'SCHOOL_CLOSURE' },
    { overlayId: 'o3', familyId: 'fam-1', date: '2026-03-19', childId: 'c1', assignedParentId: 'p1', disruptionType: 'SCHOOL_CLOSURE' },
    { overlayId: 'o4', familyId: 'fam-1', date: '2026-03-26', childId: 'c1', assignedParentId: 'p1', disruptionType: 'SCHOOL_CLOSURE' },
  ];

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

  it('second run produces no new suggestions when first run is still pending', async () => {
    const service = createService();

    const first = await service.generateSuggestions({ window: WINDOW });
    expect(first).toHaveLength(1);
    expect(first[0].suggestionType).toBe('SCHOOL_CLOSURE_COVERAGE_PREFERENCE');

    // Second run with same service and repos — pending suggestion blocks dedup
    const second = await service.generateSuggestions({ window: WINDOW });
    expect(second).toHaveLength(0);
  });

  it('pending suggestion count remains exactly 1 after repeated runs', async () => {
    const service = createService();

    await service.generateSuggestions({ window: WINDOW });
    await service.generateSuggestions({ window: WINDOW });
    await service.generateSuggestions({ window: WINDOW });

    expect(suggestionRepo.suggestions).toHaveLength(1);
    expect(suggestionRepo.suggestions[0].status).toBe('PENDING_REVIEW');
    expect(suggestionRepo.suggestions[0].suggestionType).toBe('SCHOOL_CLOSURE_COVERAGE_PREFERENCE');
  });

  it('review bundle count remains stable after repeated runs', async () => {
    const service = createService();
    await service.generateSuggestions({ window: WINDOW });
    await service.generateSuggestions({ window: WINDOW });

    const reviewService = new PolicySuggestionReviewService({
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      evidenceRepository: evidenceRepo,
    });

    const bundles = await reviewService.getPendingReviewBundles('fam-1');
    expect(bundles).toHaveLength(1);
    expect(bundles[0].suggestionType).toBe('SCHOOL_CLOSURE_COVERAGE_PREFERENCE');
    expect(bundles[0].confidenceScore).toBe(1);
  });

  it('evidence links are not duplicated for the suggestion across runs', async () => {
    const service = createService();
    const first = await service.generateSuggestions({ window: WINDOW });
    await service.generateSuggestions({ window: WINDOW });

    const links = await linkRepo.findBySuggestionId(first[0].suggestionId);
    // Links were only created once — the second run produced no new suggestion
    expect(links).toHaveLength(4);
    const linkedIds = links.map(l => l.evidenceId).sort();
    expect(linkedIds).toEqual(['overlay-o1', 'overlay-o2', 'overlay-o3', 'overlay-o4']);
  });

  it('evidence records do accumulate across runs (expected append behavior)', async () => {
    const service = createService();
    await service.generateSuggestions({ window: WINDOW });
    const countAfterFirst = evidenceRepo.records.length;

    await service.generateSuggestions({ window: WINDOW });
    const countAfterSecond = evidenceRepo.records.length;

    // Evidence is re-extracted and appended each run (in-memory append)
    expect(countAfterFirst).toBe(4);
    expect(countAfterSecond).toBe(8);
  });

  it('after accepting, rerunning creates a new pending suggestion (accepted is no longer pending)', async () => {
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

    expect(policyRepo.rules).toHaveLength(1);

    // Rerun — no pending exists, so the same pattern generates a new suggestion
    const second = await service.generateSuggestions({ window: WINDOW });
    expect(second).toHaveLength(1);
    expect(second[0].suggestionType).toBe('SCHOOL_CLOSURE_COVERAGE_PREFERENCE');
    expect(second[0].status).toBe('PENDING_REVIEW');
    expect(second[0].suggestionId).not.toBe(first[0].suggestionId);

    // Now 2 suggestions total: 1 accepted + 1 pending
    expect(suggestionRepo.suggestions).toHaveLength(2);
  });

  it('after rejecting, rerunning creates a new pending suggestion', async () => {
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

    expect(policyRepo.rules).toHaveLength(0);

    // Rejected is not pending, so a new suggestion is generated
    const second = await service.generateSuggestions({ window: WINDOW });
    expect(second).toHaveLength(1);
    expect(second[0].suggestionType).toBe('SCHOOL_CLOSURE_COVERAGE_PREFERENCE');
    expect(second[0].suggestionId).not.toBe(first[0].suggestionId);
  });
});

// ═══════════════════════════════════════════════════════════════
// Fixture B — Activity responsibility end-to-end
// ═══════════════════════════════════════════════════════════════

describe('Fixture Step4-B — activity responsibility end-to-end', () => {
  // Parent p2 handles soccer for child c1 every week
  const activities: ActivityRecord[] = [
    { activityId: 'a1', familyId: 'fam-1', date: '2026-03-03', childId: 'c1', responsibleParentId: 'p2', activityLabel: 'soccer' },
    { activityId: 'a2', familyId: 'fam-1', date: '2026-03-10', childId: 'c1', responsibleParentId: 'p2', activityLabel: 'soccer' },
    { activityId: 'a3', familyId: 'fam-1', date: '2026-03-17', childId: 'c1', responsibleParentId: 'p2', activityLabel: 'soccer' },
    { activityId: 'a4', familyId: 'fam-1', date: '2026-03-24', childId: 'c1', responsibleParentId: 'p2', activityLabel: 'soccer' },
  ];

  function createService() {
    return new PolicySuggestionService({
      extractors: [new ActivityResponsibilityEvidenceExtractor(activities)],
      detectorRegistry: new PatternDetectorRegistry(),
      evidenceRepository: evidenceRepo,
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      idGenerator: ids.gen,
    });
  }

  it('generates exactly 1 ACTIVITY_RESPONSIBILITY_RULE suggestion', async () => {
    const service = createService();
    const suggestions = await service.generateSuggestions({ window: WINDOW });

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].suggestionType).toBe('ACTIVITY_RESPONSIBILITY_RULE');
  });

  it('suggestion has exact expected field values', async () => {
    const service = createService();
    const suggestions = await service.generateSuggestions({ window: WINDOW });
    const s = suggestions[0];

    expect(s.confidenceScore).toBe(1);
    expect(s.status).toBe('PENDING_REVIEW');
    expect(s.familyId).toBe('fam-1');
    expect(s.proposedRuleType).toBe('ACTIVITY_COMMITMENT');
    expect(s.proposedPriority).toBe('SOFT');
    expect(s.proposedParameters).toEqual({
      activityLabel: 'soccer',
      preferredResponsibleParentId: 'p2',
    });
    expect(s.proposedScope).toEqual({ scopeType: 'CHILD', childId: 'c1' });
  });

  it('evidence summary has 4 occurrences with deterministic example dates', async () => {
    const service = createService();
    const suggestions = await service.generateSuggestions({ window: WINDOW });
    const summary = suggestions[0].evidenceSummary;

    expect(summary.occurrenceCount).toBe(4);
    expect(summary.windowStart).toBe('2026-03-01');
    expect(summary.windowEnd).toBe('2026-03-31');
    expect(summary.representativeExamples).toHaveLength(4);
    expect(summary.representativeExamples.map(e => e.date)).toEqual([
      '2026-03-03', '2026-03-10', '2026-03-17', '2026-03-24',
    ]);

    for (const ex of summary.representativeExamples) {
      expect(ex.data.activityLabel).toBe('soccer');
      expect(ex.data.responsibleParentId).toBe('p2');
    }
  });

  it('linked evidence IDs are correct', async () => {
    const service = createService();
    const suggestions = await service.generateSuggestions({ window: WINDOW });
    const links = await linkRepo.findBySuggestionId(suggestions[0].suggestionId);

    expect(links).toHaveLength(4);
    const linkedIds = links.map(l => l.evidenceId).sort();
    expect(linkedIds).toEqual(['activity-a1', 'activity-a2', 'activity-a3', 'activity-a4']);
  });

  it('review bundle artifact payloads are correct', async () => {
    const service = createService();
    const suggestions = await service.generateSuggestions({ window: WINDOW });

    const reviewService = new PolicySuggestionReviewService({
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      evidenceRepository: evidenceRepo,
    });

    const bundle = await reviewService.getReviewBundle(suggestions[0].suggestionId);

    expect(bundle.suggestionType).toBe('ACTIVITY_RESPONSIBILITY_RULE');
    expect(bundle.confidenceScore).toBe(1);
    expect(bundle.proposedParameters).toEqual({
      activityLabel: 'soccer',
      preferredResponsibleParentId: 'p2',
    });

    const countArtifact = bundle.artifacts.find(a => a.type === 'EVIDENCE_COUNT_SUMMARY')!;
    expect(countArtifact.data.totalEvidenceCount).toBe(4);
    expect(countArtifact.data.evidenceTypes).toEqual({ ACTIVITY_RESPONSIBILITY: 4 });

    const ruleArtifact = bundle.artifacts.find(a => a.type === 'PROPOSED_RULE')!;
    expect(ruleArtifact.data.ruleType).toBe('ACTIVITY_COMMITMENT');
    expect(ruleArtifact.data.parameters).toEqual({
      activityLabel: 'soccer',
      preferredResponsibleParentId: 'p2',
    });
    expect(ruleArtifact.data.scope).toEqual({ scopeType: 'CHILD', childId: 'c1' });

    const confidenceArtifact = bundle.artifacts.find(a => a.type === 'CONFIDENCE_INPUTS')!;
    expect(confidenceArtifact.data.confidenceScore).toBe(1);
    expect(confidenceArtifact.data.suggestionType).toBe('ACTIVITY_RESPONSIBILITY_RULE');
  });

  it('accepting creates correct ACTIVITY_COMMITMENT policy rule', async () => {
    const service = createService();
    const suggestions = await service.generateSuggestions({ window: WINDOW });

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
    expect(result.createdPolicyRuleId).toBeDefined();

    const rule = await policyRepo.findById(result.createdPolicyRuleId!);
    expect(rule).not.toBeNull();
    expect(rule!.ruleType).toBe('ACTIVITY_COMMITMENT');
    expect(rule!.priority).toBe('SOFT');
    expect(rule!.active).toBe(true);
    expect(rule!.familyId).toBe('fam-1');
    expect(rule!.parameters).toEqual({
      activityLabel: 'soccer',
      preferredResponsibleParentId: 'p2',
    });
    expect(rule!.scope.scopeType).toBe('CHILD');
    expect(rule!.scope.childId).toBe('c1');
    expect(rule!.label).toBe('Auto-suggested: ACTIVITY_RESPONSIBILITY_RULE');
  });

  it('rerunning after acceptance creates new pending (accepted is not pending)', async () => {
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

    const second = await service.generateSuggestions({ window: WINDOW });
    // Accepted suggestion is no longer pending → dedup doesn't block
    expect(second).toHaveLength(1);
    expect(second[0].suggestionType).toBe('ACTIVITY_RESPONSIBILITY_RULE');
    expect(second[0].suggestionId).not.toBe(first[0].suggestionId);
  });

  it('weak activity data (split between parents) generates no suggestion', async () => {
    // 2 by p1, 2 by p2 — neither reaches 70% dominance
    const weakActivities: ActivityRecord[] = [
      { activityId: 'a1', familyId: 'fam-1', date: '2026-03-03', childId: 'c1', responsibleParentId: 'p1', activityLabel: 'soccer' },
      { activityId: 'a2', familyId: 'fam-1', date: '2026-03-10', childId: 'c1', responsibleParentId: 'p2', activityLabel: 'soccer' },
      { activityId: 'a3', familyId: 'fam-1', date: '2026-03-17', childId: 'c1', responsibleParentId: 'p1', activityLabel: 'soccer' },
      { activityId: 'a4', familyId: 'fam-1', date: '2026-03-24', childId: 'c1', responsibleParentId: 'p2', activityLabel: 'soccer' },
    ];

    const service = new PolicySuggestionService({
      extractors: [new ActivityResponsibilityEvidenceExtractor(weakActivities)],
      detectorRegistry: new PatternDetectorRegistry(),
      evidenceRepository: evidenceRepo,
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      idGenerator: ids.gen,
    });

    const suggestions = await service.generateSuggestions({ window: WINDOW });
    expect(suggestions).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// Fixture C — Sibling divergence preference end-to-end
// ═══════════════════════════════════════════════════════════════

describe('Fixture Step4-C — sibling divergence preference end-to-end', () => {
  // 4 proposals, each with 2 children (c1, c2) diverging:
  // c1 always with p1, c2 always with p2 (different parents → divergence)
  const divergentProposals: AcceptedProposalRecord[] = [
    {
      proposalId: 'dp-1', familyId: 'fam-1', acceptedAt: '2026-03-02T10:00:00Z', acceptedByParentId: 'p1',
      scheduleNights: [
        { date: '2026-03-03', childId: 'c1', parentId: 'p1' },
        { date: '2026-03-04', childId: 'c1', parentId: 'p1' },
        { date: '2026-03-05', childId: 'c1', parentId: 'p1' },
        { date: '2026-03-03', childId: 'c2', parentId: 'p2' },
        { date: '2026-03-04', childId: 'c2', parentId: 'p2' },
        { date: '2026-03-05', childId: 'c2', parentId: 'p2' },
      ],
    },
    {
      proposalId: 'dp-2', familyId: 'fam-1', acceptedAt: '2026-03-09T10:00:00Z', acceptedByParentId: 'p1',
      scheduleNights: [
        { date: '2026-03-10', childId: 'c1', parentId: 'p1' },
        { date: '2026-03-11', childId: 'c1', parentId: 'p1' },
        { date: '2026-03-12', childId: 'c1', parentId: 'p1' },
        { date: '2026-03-10', childId: 'c2', parentId: 'p2' },
        { date: '2026-03-11', childId: 'c2', parentId: 'p2' },
        { date: '2026-03-12', childId: 'c2', parentId: 'p2' },
      ],
    },
    {
      proposalId: 'dp-3', familyId: 'fam-1', acceptedAt: '2026-03-16T10:00:00Z', acceptedByParentId: 'p2',
      scheduleNights: [
        { date: '2026-03-17', childId: 'c1', parentId: 'p1' },
        { date: '2026-03-18', childId: 'c1', parentId: 'p1' },
        { date: '2026-03-19', childId: 'c1', parentId: 'p1' },
        { date: '2026-03-17', childId: 'c2', parentId: 'p2' },
        { date: '2026-03-18', childId: 'c2', parentId: 'p2' },
        { date: '2026-03-19', childId: 'c2', parentId: 'p2' },
      ],
    },
    {
      proposalId: 'dp-4', familyId: 'fam-1', acceptedAt: '2026-03-23T10:00:00Z', acceptedByParentId: 'p1',
      scheduleNights: [
        { date: '2026-03-24', childId: 'c1', parentId: 'p1' },
        { date: '2026-03-25', childId: 'c1', parentId: 'p1' },
        { date: '2026-03-26', childId: 'c1', parentId: 'p1' },
        { date: '2026-03-24', childId: 'c2', parentId: 'p2' },
        { date: '2026-03-25', childId: 'c2', parentId: 'p2' },
        { date: '2026-03-26', childId: 'c2', parentId: 'p2' },
      ],
    },
  ];

  function createService(proposals: AcceptedProposalRecord[]) {
    return new PolicySuggestionService({
      extractors: [new AcceptedProposalEvidenceExtractor(proposals)],
      detectorRegistry: new PatternDetectorRegistry(),
      evidenceRepository: evidenceRepo,
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      idGenerator: ids.gen,
    });
  }

  it('generates SIBLING_DIVERGENCE_PREFERENCE suggestion', async () => {
    const service = createService(divergentProposals);
    const suggestions = await service.generateSuggestions({ window: WINDOW });

    const divSuggestion = suggestions.find(s => s.suggestionType === 'SIBLING_DIVERGENCE_PREFERENCE');
    expect(divSuggestion).toBeDefined();
  });

  it('divergence suggestion has exact expected field values', async () => {
    const service = createService(divergentProposals);
    const suggestions = await service.generateSuggestions({ window: WINDOW });
    const s = suggestions.find(s => s.suggestionType === 'SIBLING_DIVERGENCE_PREFERENCE')!;

    // 4 multi-child proposals, all divergent → ratio=4/4=1.0
    expect(s.confidenceScore).toBe(1);
    expect(s.status).toBe('PENDING_REVIEW');
    expect(s.familyId).toBe('fam-1');
    expect(s.proposedRuleType).toBe('SIBLING_COHESION');
    expect(s.proposedPriority).toBe('SOFT');
    expect(s.proposedParameters).toEqual({ allowDivergence: true });
    expect(s.proposedScope).toEqual({ scopeType: 'FAMILY' });
  });

  it('evidence summary occurrenceCount matches supporting evidence count', async () => {
    const service = createService(divergentProposals);
    const suggestions = await service.generateSuggestions({ window: WINDOW });
    const s = suggestions.find(s => s.suggestionType === 'SIBLING_DIVERGENCE_PREFERENCE')!;

    // Each proposal produces 2 evidence records (c1-p1, c2-p2), 4 proposals → 8 total
    // All 8 are supporting evidence for the divergence suggestion
    expect(s.evidenceSummary.occurrenceCount).toBe(8);
    expect(s.evidenceSummary.representativeExamples.length).toBeLessThanOrEqual(5);
  });

  it('review bundle has correct artifact payloads', async () => {
    const service = createService(divergentProposals);
    const suggestions = await service.generateSuggestions({ window: WINDOW });
    const divS = suggestions.find(s => s.suggestionType === 'SIBLING_DIVERGENCE_PREFERENCE')!;

    const reviewService = new PolicySuggestionReviewService({
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      evidenceRepository: evidenceRepo,
    });

    const bundle = await reviewService.getReviewBundle(divS.suggestionId);

    expect(bundle.suggestionType).toBe('SIBLING_DIVERGENCE_PREFERENCE');
    expect(bundle.proposedParameters).toEqual({ allowDivergence: true });

    const countArtifact = bundle.artifacts.find(a => a.type === 'EVIDENCE_COUNT_SUMMARY')!;
    expect(countArtifact.data.totalEvidenceCount).toBe(8);
    expect(countArtifact.data.evidenceTypes).toEqual({ ACCEPTED_PROPOSAL: 8 });

    const ruleArtifact = bundle.artifacts.find(a => a.type === 'PROPOSED_RULE')!;
    expect(ruleArtifact.data.ruleType).toBe('SIBLING_COHESION');
    expect(ruleArtifact.data.parameters).toEqual({ allowDivergence: true });
    expect(ruleArtifact.data.scope).toEqual({ scopeType: 'FAMILY' });
  });

  it('accepting creates correct SIBLING_COHESION policy rule', async () => {
    const service = createService(divergentProposals);
    const suggestions = await service.generateSuggestions({ window: WINDOW });
    const divS = suggestions.find(s => s.suggestionType === 'SIBLING_DIVERGENCE_PREFERENCE')!;

    const workflow = new PolicySuggestionResolutionWorkflow({
      suggestionRepository: suggestionRepo,
      policyRuleRepository: policyRepo,
      idGenerator: ids.gen,
    });

    const result = await workflow.resolveSuggestion({
      suggestionId: divS.suggestionId,
      decision: 'ACCEPT',
      resolvedAt: '2026-03-29T10:00:00Z',
      resolvedBy: 'parent-p1',
    });

    expect(result.status).toBe('ACCEPTED');

    const rule = await policyRepo.findById(result.createdPolicyRuleId!);
    expect(rule).not.toBeNull();
    expect(rule!.ruleType).toBe('SIBLING_COHESION');
    expect(rule!.priority).toBe('SOFT');
    expect(rule!.active).toBe(true);
    expect(rule!.familyId).toBe('fam-1');
    expect(rule!.parameters).toEqual({ allowDivergence: true });
    expect(rule!.scope.scopeType).toBe('FAMILY');
    expect(rule!.label).toBe('Auto-suggested: SIBLING_DIVERGENCE_PREFERENCE');
  });

  it('non-divergent siblings (same parent) produce no divergence suggestion', async () => {
    // Both children go to same parent in every proposal → no divergence
    const cohesiveProposals: AcceptedProposalRecord[] = [
      {
        proposalId: 'cp-1', familyId: 'fam-1', acceptedAt: '2026-03-02T10:00:00Z', acceptedByParentId: 'p1',
        scheduleNights: [
          { date: '2026-03-03', childId: 'c1', parentId: 'p1' },
          { date: '2026-03-04', childId: 'c1', parentId: 'p1' },
          { date: '2026-03-05', childId: 'c1', parentId: 'p1' },
          { date: '2026-03-03', childId: 'c2', parentId: 'p1' },
          { date: '2026-03-04', childId: 'c2', parentId: 'p1' },
          { date: '2026-03-05', childId: 'c2', parentId: 'p1' },
        ],
      },
      {
        proposalId: 'cp-2', familyId: 'fam-1', acceptedAt: '2026-03-09T10:00:00Z', acceptedByParentId: 'p1',
        scheduleNights: [
          { date: '2026-03-10', childId: 'c1', parentId: 'p1' },
          { date: '2026-03-11', childId: 'c1', parentId: 'p1' },
          { date: '2026-03-12', childId: 'c1', parentId: 'p1' },
          { date: '2026-03-10', childId: 'c2', parentId: 'p1' },
          { date: '2026-03-11', childId: 'c2', parentId: 'p1' },
          { date: '2026-03-12', childId: 'c2', parentId: 'p1' },
        ],
      },
      {
        proposalId: 'cp-3', familyId: 'fam-1', acceptedAt: '2026-03-16T10:00:00Z', acceptedByParentId: 'p2',
        scheduleNights: [
          { date: '2026-03-17', childId: 'c1', parentId: 'p2' },
          { date: '2026-03-18', childId: 'c1', parentId: 'p2' },
          { date: '2026-03-19', childId: 'c1', parentId: 'p2' },
          { date: '2026-03-17', childId: 'c2', parentId: 'p2' },
          { date: '2026-03-18', childId: 'c2', parentId: 'p2' },
          { date: '2026-03-19', childId: 'c2', parentId: 'p2' },
        ],
      },
      {
        proposalId: 'cp-4', familyId: 'fam-1', acceptedAt: '2026-03-23T10:00:00Z', acceptedByParentId: 'p1',
        scheduleNights: [
          { date: '2026-03-24', childId: 'c1', parentId: 'p1' },
          { date: '2026-03-25', childId: 'c1', parentId: 'p1' },
          { date: '2026-03-26', childId: 'c1', parentId: 'p1' },
          { date: '2026-03-24', childId: 'c2', parentId: 'p1' },
          { date: '2026-03-25', childId: 'c2', parentId: 'p1' },
          { date: '2026-03-26', childId: 'c2', parentId: 'p1' },
        ],
      },
    ];

    const service = createService(cohesiveProposals);
    const suggestions = await service.generateSuggestions({ window: WINDOW });

    const divS = suggestions.find(s => s.suggestionType === 'SIBLING_DIVERGENCE_PREFERENCE');
    expect(divS).toBeUndefined();
  });

  it('also generates MIN_BLOCK_LENGTH_ADJUSTMENT alongside divergence', async () => {
    // The divergent proposals also have block lengths of 3, which triggers
    // MinBlockLengthAdjustmentDetector. Verify both coexist.
    const service = createService(divergentProposals);
    const suggestions = await service.generateSuggestions({ window: WINDOW });

    const types = suggestions.map(s => s.suggestionType).sort();
    expect(types).toContain('SIBLING_DIVERGENCE_PREFERENCE');
    expect(types).toContain('MIN_BLOCK_LENGTH_ADJUSTMENT');
  });
});

// ═══════════════════════════════════════════════════════════════
// Fixture D — Unsupported exchange-day repeated-run safety
// ═══════════════════════════════════════════════════════════════

describe('Fixture Step4-D — unsupported exchange-day repeated-run safety', () => {
  const sundayExchanges: ExchangeRecord[] = [
    { exchangeId: 'e1', familyId: 'fam-1', date: '2026-03-01', childId: 'c1', fromParentId: 'p1', toParentId: 'p2', time: '09:00', location: 'School' },
    { exchangeId: 'e2', familyId: 'fam-1', date: '2026-03-08', childId: 'c1', fromParentId: 'p2', toParentId: 'p1', time: '09:00', location: 'School' },
    { exchangeId: 'e3', familyId: 'fam-1', date: '2026-03-15', childId: 'c1', fromParentId: 'p1', toParentId: 'p2', time: '09:00', location: 'School' },
    { exchangeId: 'e4', familyId: 'fam-1', date: '2026-03-22', childId: 'c1', fromParentId: 'p2', toParentId: 'p1', time: '09:00', location: 'School' },
  ];

  function createService() {
    return new PolicySuggestionService({
      extractors: [new ExchangePatternEvidenceExtractor(sundayExchanges)],
      detectorRegistry: new PatternDetectorRegistry(),
      evidenceRepository: evidenceRepo,
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      idGenerator: ids.gen,
    });
  }

  it('generates exchange-day pending, acceptance fails, no policy rule created', async () => {
    const service = createService();
    const suggestions = await service.generateSuggestions({ window: WINDOW });

    const daySuggestion = suggestions.find(s => s.suggestionType === 'PREFERRED_EXCHANGE_DAY')!;
    expect(daySuggestion).toBeDefined();
    expect(daySuggestion.status).toBe('PENDING_REVIEW');

    const workflow = new PolicySuggestionResolutionWorkflow({
      suggestionRepository: suggestionRepo,
      policyRuleRepository: policyRepo,
      idGenerator: ids.gen,
    });

    await expect(
      workflow.resolveSuggestion({
        suggestionId: daySuggestion.suggestionId,
        decision: 'ACCEPT',
        resolvedAt: '2026-03-28T10:00:00Z',
        resolvedBy: 'parent-p1',
      }),
    ).rejects.toThrow('Unsupported suggestion conversion');

    // After failed acceptance: no policy rules
    expect(policyRepo.rules).toHaveLength(0);

    // Suggestion remains PENDING_REVIEW (acceptance threw before updating)
    const updated = await suggestionRepo.findById(daySuggestion.suggestionId);
    expect(updated!.status).toBe('PENDING_REVIEW');
  });

  it('rerun after failed acceptance does not create duplicate pending', async () => {
    const service = createService();
    const first = await service.generateSuggestions({ window: WINDOW });

    const daySuggestion = first.find(s => s.suggestionType === 'PREFERRED_EXCHANGE_DAY')!;

    const workflow = new PolicySuggestionResolutionWorkflow({
      suggestionRepository: suggestionRepo,
      policyRuleRepository: policyRepo,
      idGenerator: ids.gen,
    });

    // Failed acceptance
    await expect(
      workflow.resolveSuggestion({
        suggestionId: daySuggestion.suggestionId,
        decision: 'ACCEPT',
        resolvedAt: '2026-03-28T10:00:00Z',
        resolvedBy: 'parent-p1',
      }),
    ).rejects.toThrow();

    // Rerun — the suggestion is still pending, so dedup blocks the same pattern
    const second = await service.generateSuggestions({ window: WINDOW });
    expect(second).toHaveLength(0);

    // Total pending suggestions remain exactly 2 (day + location from first run)
    const pending = await suggestionRepo.findPendingByFamilyId('fam-1');
    expect(pending).toHaveLength(2);
    expect(pending.map(p => p.suggestionType).sort()).toEqual([
      'PREFERRED_EXCHANGE_DAY',
      'PREFERRED_EXCHANGE_LOCATION',
    ]);
  });

  it('review bundles remain stable after failed acceptance and rerun', async () => {
    const service = createService();
    await service.generateSuggestions({ window: WINDOW });

    const reviewService = new PolicySuggestionReviewService({
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      evidenceRepository: evidenceRepo,
    });

    const bundlesBefore = await reviewService.getPendingReviewBundles('fam-1');

    // Attempt failed acceptance
    const workflow = new PolicySuggestionResolutionWorkflow({
      suggestionRepository: suggestionRepo,
      policyRuleRepository: policyRepo,
      idGenerator: ids.gen,
    });

    const daySuggestion = bundlesBefore.find(b => b.suggestionType === 'PREFERRED_EXCHANGE_DAY')!;
    try {
      await workflow.resolveSuggestion({
        suggestionId: daySuggestion.suggestionId,
        decision: 'ACCEPT',
        resolvedAt: '2026-03-28T10:00:00Z',
        resolvedBy: 'parent-p1',
      });
    } catch {
      // Expected failure
    }

    // Rerun generation
    await service.generateSuggestions({ window: WINDOW });

    const bundlesAfter = await reviewService.getPendingReviewBundles('fam-1');

    // Same count, same types, same confidence
    expect(bundlesAfter).toHaveLength(bundlesBefore.length);
    expect(bundlesAfter.map(b => b.suggestionType).sort())
      .toEqual(bundlesBefore.map(b => b.suggestionType).sort());

    for (const after of bundlesAfter) {
      const before = bundlesBefore.find(b => b.suggestionType === after.suggestionType)!;
      expect(after.confidenceScore).toBe(before.confidenceScore);
      expect(after.proposedParameters).toEqual(before.proposedParameters);
    }
  });

  it('rejecting the unsupported suggestion then rerunning re-generates it', async () => {
    const service = createService();
    const first = await service.generateSuggestions({ window: WINDOW });

    const daySuggestion = first.find(s => s.suggestionType === 'PREFERRED_EXCHANGE_DAY')!;

    const workflow = new PolicySuggestionResolutionWorkflow({
      suggestionRepository: suggestionRepo,
      policyRuleRepository: policyRepo,
      idGenerator: ids.gen,
    });

    // Reject the unsupported one
    await workflow.resolveSuggestion({
      suggestionId: daySuggestion.suggestionId,
      decision: 'REJECT',
      resolvedAt: '2026-03-28T10:00:00Z',
      resolvedBy: 'parent-p1',
    });

    // Now only PREFERRED_EXCHANGE_LOCATION is pending
    const pending = await suggestionRepo.findPendingByFamilyId('fam-1');
    expect(pending).toHaveLength(1);
    expect(pending[0].suggestionType).toBe('PREFERRED_EXCHANGE_LOCATION');

    // Rerun — exchange-day is no longer pending, so it gets re-generated
    const second = await service.generateSuggestions({ window: WINDOW });
    expect(second).toHaveLength(1);
    expect(second[0].suggestionType).toBe('PREFERRED_EXCHANGE_DAY');

    // Still no policy rules created
    expect(policyRepo.rules).toHaveLength(0);
  });

  it('accepting location while day remains pending leaves state coherent', async () => {
    const service = createService();
    const first = await service.generateSuggestions({ window: WINDOW });

    const locSuggestion = first.find(s => s.suggestionType === 'PREFERRED_EXCHANGE_LOCATION')!;
    const daySuggestion = first.find(s => s.suggestionType === 'PREFERRED_EXCHANGE_DAY')!;

    const workflow = new PolicySuggestionResolutionWorkflow({
      suggestionRepository: suggestionRepo,
      policyRuleRepository: policyRepo,
      idGenerator: ids.gen,
    });

    // Accept the supported one
    const result = await workflow.resolveSuggestion({
      suggestionId: locSuggestion.suggestionId,
      decision: 'ACCEPT',
      resolvedAt: '2026-03-28T10:00:00Z',
      resolvedBy: 'parent-p1',
    });

    expect(result.status).toBe('ACCEPTED');
    expect(policyRepo.rules).toHaveLength(1);

    // Day suggestion is still pending
    const updatedDay = await suggestionRepo.findById(daySuggestion.suggestionId);
    expect(updatedDay!.status).toBe('PENDING_REVIEW');

    // Only 1 pending now
    const pending = await suggestionRepo.findPendingByFamilyId('fam-1');
    expect(pending).toHaveLength(1);
    expect(pending[0].suggestionType).toBe('PREFERRED_EXCHANGE_DAY');

    // Rerun — day is still pending (dedup blocks), location was accepted (not pending, re-generates)
    const second = await service.generateSuggestions({ window: WINDOW });
    expect(second).toHaveLength(1);
    expect(second[0].suggestionType).toBe('PREFERRED_EXCHANGE_LOCATION');
  });
});
