import { describe, it, expect, beforeEach } from 'vitest';
import { PolicySuggestionService } from '../core/PolicySuggestionService';
import { PolicySuggestionResolutionWorkflow } from '../suggestions/PolicySuggestionResolutionWorkflow';
import { PolicySuggestionReviewService } from '../review/PolicySuggestionReviewService';
import { PatternDetectorRegistry } from '../detectors/PatternDetectorRegistry';
import { ExchangePatternEvidenceExtractor, ExchangeRecord } from '../evidence/ExchangePatternEvidenceExtractor';
import { OverlayCoverageEvidenceExtractor, OverlayCoverageRecord } from '../evidence/OverlayCoverageEvidenceExtractor';
import { AcceptedProposalEvidenceExtractor, AcceptedProposalRecord } from '../evidence/AcceptedProposalEvidenceExtractor';
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

// ─── Fixture A: Repeated Sunday exchanges ────────────────────

describe('Fixture A — repeated Sunday exchanges at School', () => {
  // All 4 Sundays in March 2026 (day 0), same location 'School'
  const sundayExchanges: ExchangeRecord[] = [
    { exchangeId: 'e1', familyId: 'fam-1', date: '2026-03-01', childId: 'c1', fromParentId: 'p1', toParentId: 'p2', time: '09:00', location: 'School' },
    { exchangeId: 'e2', familyId: 'fam-1', date: '2026-03-08', childId: 'c1', fromParentId: 'p2', toParentId: 'p1', time: '09:00', location: 'School' },
    { exchangeId: 'e3', familyId: 'fam-1', date: '2026-03-15', childId: 'c1', fromParentId: 'p1', toParentId: 'p2', time: '09:00', location: 'School' },
    { exchangeId: 'e4', familyId: 'fam-1', date: '2026-03-22', childId: 'c1', fromParentId: 'p2', toParentId: 'p1', time: '09:00', location: 'School' },
  ];

  it('generates exactly 2 suggestions: PREFERRED_EXCHANGE_DAY and PREFERRED_EXCHANGE_LOCATION', async () => {
    const service = new PolicySuggestionService({
      extractors: [new ExchangePatternEvidenceExtractor(sundayExchanges)],
      detectorRegistry: new PatternDetectorRegistry(),
      evidenceRepository: evidenceRepo,
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      idGenerator: ids.gen,
    });

    const suggestions = await service.generateSuggestions({ window: WINDOW });

    expect(suggestions).toHaveLength(2);

    // Sorted by confidence (tie at 1.0) then alphabetical type
    // PREFERRED_EXCHANGE_DAY < PREFERRED_EXCHANGE_LOCATION alphabetically
    expect(suggestions[0].suggestionType).toBe('PREFERRED_EXCHANGE_DAY');
    expect(suggestions[1].suggestionType).toBe('PREFERRED_EXCHANGE_LOCATION');
  });

  it('PREFERRED_EXCHANGE_DAY has exact expected values', async () => {
    const service = new PolicySuggestionService({
      extractors: [new ExchangePatternEvidenceExtractor(sundayExchanges)],
      detectorRegistry: new PatternDetectorRegistry(),
      evidenceRepository: evidenceRepo,
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      idGenerator: ids.gen,
    });

    const suggestions = await service.generateSuggestions({ window: WINDOW });
    const daySuggestion = suggestions.find(s => s.suggestionType === 'PREFERRED_EXCHANGE_DAY')!;

    expect(daySuggestion.confidenceScore).toBe(1);
    expect(daySuggestion.status).toBe('PENDING_REVIEW');
    expect(daySuggestion.familyId).toBe('fam-1');
    expect(daySuggestion.proposedRuleType).toBe('EXCHANGE_LOCATION');
    expect(daySuggestion.proposedPriority).toBe('SOFT');
    expect(daySuggestion.proposedParameters).toEqual({ preferredExchangeDay: 0 });
    expect(daySuggestion.proposedScope).toEqual({ scopeType: 'FAMILY' });
    expect(daySuggestion.evidenceSummary.occurrenceCount).toBe(4);
    expect(daySuggestion.evidenceSummary.windowStart).toBe('2026-03-01');
    expect(daySuggestion.evidenceSummary.windowEnd).toBe('2026-03-31');
    expect(daySuggestion.evidenceSummary.representativeExamples).toHaveLength(4);
  });

  it('PREFERRED_EXCHANGE_LOCATION has exact expected values', async () => {
    const service = new PolicySuggestionService({
      extractors: [new ExchangePatternEvidenceExtractor(sundayExchanges)],
      detectorRegistry: new PatternDetectorRegistry(),
      evidenceRepository: evidenceRepo,
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      idGenerator: ids.gen,
    });

    const suggestions = await service.generateSuggestions({ window: WINDOW });
    const locSuggestion = suggestions.find(s => s.suggestionType === 'PREFERRED_EXCHANGE_LOCATION')!;

    expect(locSuggestion.confidenceScore).toBe(1);
    expect(locSuggestion.proposedParameters).toEqual({ preferredLocation: 'School' });
    expect(locSuggestion.evidenceSummary.occurrenceCount).toBe(4);
    expect(locSuggestion.evidenceSummary.representativeExamples).toHaveLength(4);

    // All representative examples should have dayOfWeek=0 and location='School'
    for (const ex of locSuggestion.evidenceSummary.representativeExamples) {
      expect(ex.data.dayOfWeek).toBe(0);
      expect(ex.data.location).toBe('School');
    }
  });

  it('representative example dates are deterministic and in chronological order', async () => {
    const service = new PolicySuggestionService({
      extractors: [new ExchangePatternEvidenceExtractor(sundayExchanges)],
      detectorRegistry: new PatternDetectorRegistry(),
      evidenceRepository: evidenceRepo,
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      idGenerator: ids.gen,
    });

    const suggestions = await service.generateSuggestions({ window: WINDOW });
    const daySuggestion = suggestions.find(s => s.suggestionType === 'PREFERRED_EXCHANGE_DAY')!;

    const exDates = daySuggestion.evidenceSummary.representativeExamples.map(e => e.date);
    expect(exDates).toEqual(['2026-03-01', '2026-03-08', '2026-03-15', '2026-03-22']);
  });

  it('evidence records are persisted with correct IDs', async () => {
    const service = new PolicySuggestionService({
      extractors: [new ExchangePatternEvidenceExtractor(sundayExchanges)],
      detectorRegistry: new PatternDetectorRegistry(),
      evidenceRepository: evidenceRepo,
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      idGenerator: ids.gen,
    });

    await service.generateSuggestions({ window: WINDOW });

    const evidenceIds = evidenceRepo.records.map(r => r.evidenceId).sort();
    expect(evidenceIds).toEqual(['exchange-e1', 'exchange-e2', 'exchange-e3', 'exchange-e4']);
  });

  it('evidence links are created for both suggestions', async () => {
    const service = new PolicySuggestionService({
      extractors: [new ExchangePatternEvidenceExtractor(sundayExchanges)],
      detectorRegistry: new PatternDetectorRegistry(),
      evidenceRepository: evidenceRepo,
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      idGenerator: ids.gen,
    });

    const suggestions = await service.generateSuggestions({ window: WINDOW });

    for (const s of suggestions) {
      const links = await linkRepo.findBySuggestionId(s.suggestionId);
      expect(links).toHaveLength(4);
      const linkedEvidenceIds = links.map(l => l.evidenceId).sort();
      expect(linkedEvidenceIds).toEqual(['exchange-e1', 'exchange-e2', 'exchange-e3', 'exchange-e4']);
    }
  });

  it('PREFERRED_EXCHANGE_DAY acceptance throws UnsupportedSuggestionConversionError', async () => {
    const service = new PolicySuggestionService({
      extractors: [new ExchangePatternEvidenceExtractor(sundayExchanges)],
      detectorRegistry: new PatternDetectorRegistry(),
      evidenceRepository: evidenceRepo,
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      idGenerator: ids.gen,
    });

    const suggestions = await service.generateSuggestions({ window: WINDOW });
    const daySuggestion = suggestions.find(s => s.suggestionType === 'PREFERRED_EXCHANGE_DAY')!;

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

    expect(policyRepo.rules).toHaveLength(0);
  });

  it('PREFERRED_EXCHANGE_LOCATION acceptance creates EXCHANGE_LOCATION policy rule', async () => {
    const service = new PolicySuggestionService({
      extractors: [new ExchangePatternEvidenceExtractor(sundayExchanges)],
      detectorRegistry: new PatternDetectorRegistry(),
      evidenceRepository: evidenceRepo,
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      idGenerator: ids.gen,
    });

    const suggestions = await service.generateSuggestions({ window: WINDOW });
    const locSuggestion = suggestions.find(s => s.suggestionType === 'PREFERRED_EXCHANGE_LOCATION')!;

    const workflow = new PolicySuggestionResolutionWorkflow({
      suggestionRepository: suggestionRepo,
      policyRuleRepository: policyRepo,
      idGenerator: ids.gen,
    });

    const result = await workflow.resolveSuggestion({
      suggestionId: locSuggestion.suggestionId,
      decision: 'ACCEPT',
      resolvedAt: '2026-03-28T10:00:00Z',
      resolvedBy: 'parent-p1',
    });

    expect(result.status).toBe('ACCEPTED');
    expect(result.createdPolicyRuleId).toBeDefined();

    const rule = await policyRepo.findById(result.createdPolicyRuleId!);
    expect(rule).not.toBeNull();
    expect(rule!.ruleType).toBe('EXCHANGE_LOCATION');
    expect(rule!.priority).toBe('SOFT');
    expect(rule!.active).toBe(true);
    expect(rule!.familyId).toBe('fam-1');
    expect(rule!.parameters).toEqual({ preferredLocation: 'School' });
    expect(rule!.scope.scopeType).toBe('FAMILY');
    expect(rule!.label).toBe('Auto-suggested: PREFERRED_EXCHANGE_LOCATION');

    const updated = await suggestionRepo.findById(locSuggestion.suggestionId);
    expect(updated!.status).toBe('ACCEPTED');
    expect(updated!.resolvedBy).toBe('parent-p1');
  });

  it('review bundle for PREFERRED_EXCHANGE_LOCATION reflects correct metadata', async () => {
    const service = new PolicySuggestionService({
      extractors: [new ExchangePatternEvidenceExtractor(sundayExchanges)],
      detectorRegistry: new PatternDetectorRegistry(),
      evidenceRepository: evidenceRepo,
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      idGenerator: ids.gen,
    });

    const suggestions = await service.generateSuggestions({ window: WINDOW });
    const locSuggestion = suggestions.find(s => s.suggestionType === 'PREFERRED_EXCHANGE_LOCATION')!;

    const reviewService = new PolicySuggestionReviewService({
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      evidenceRepository: evidenceRepo,
    });

    const bundle = await reviewService.getReviewBundle(locSuggestion.suggestionId);

    expect(bundle.suggestionType).toBe('PREFERRED_EXCHANGE_LOCATION');
    expect(bundle.status).toBe('PENDING_REVIEW');
    expect(bundle.confidenceScore).toBe(1);
    expect(bundle.proposedRuleType).toBe('EXCHANGE_LOCATION');
    expect(bundle.proposedPriority).toBe('SOFT');
    expect(bundle.proposedParameters).toEqual({ preferredLocation: 'School' });
    expect(bundle.evidenceSummary.occurrenceCount).toBe(4);
    expect(bundle.artifacts).toHaveLength(4);

    const evidenceSummaryArtifact = bundle.artifacts.find(a => a.type === 'EVIDENCE_COUNT_SUMMARY')!;
    expect(evidenceSummaryArtifact.data.totalEvidenceCount).toBe(4);
    expect(evidenceSummaryArtifact.data.evidenceTypes).toEqual({ EXCHANGE_PATTERN: 4 });

    const proposedRule = bundle.artifacts.find(a => a.type === 'PROPOSED_RULE')!;
    expect(proposedRule.data.ruleType).toBe('EXCHANGE_LOCATION');
    expect(proposedRule.data.parameters).toEqual({ preferredLocation: 'School' });
  });

  it('review bundle for PREFERRED_EXCHANGE_DAY honestly reflects unsupported state', async () => {
    const service = new PolicySuggestionService({
      extractors: [new ExchangePatternEvidenceExtractor(sundayExchanges)],
      detectorRegistry: new PatternDetectorRegistry(),
      evidenceRepository: evidenceRepo,
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      idGenerator: ids.gen,
    });

    const suggestions = await service.generateSuggestions({ window: WINDOW });
    const daySuggestion = suggestions.find(s => s.suggestionType === 'PREFERRED_EXCHANGE_DAY')!;

    const reviewService = new PolicySuggestionReviewService({
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      evidenceRepository: evidenceRepo,
    });

    const bundle = await reviewService.getReviewBundle(daySuggestion.suggestionId);

    // The review bundle is valid — it correctly describes the suggestion
    expect(bundle.suggestionType).toBe('PREFERRED_EXCHANGE_DAY');
    expect(bundle.proposedParameters).toEqual({ preferredExchangeDay: 0 });
    expect(bundle.evidenceSummary.occurrenceCount).toBe(4);

    // But the proposedRuleType is 'EXCHANGE_LOCATION', which is misleading
    // This is an honest reflection of the current implementation
    expect(bundle.proposedRuleType).toBe('EXCHANGE_LOCATION');
  });

  it('produces identical output on a second run with same inputs', async () => {
    const run = async () => {
      const er = new InMemoryEvidenceRepo();
      const sr = new InMemorySuggestionRepo();
      const lr = new InMemoryLinkRepo();
      const id = makeIdGenerator();
      const svc = new PolicySuggestionService({
        extractors: [new ExchangePatternEvidenceExtractor(sundayExchanges)],
        detectorRegistry: new PatternDetectorRegistry(),
        evidenceRepository: er,
        suggestionRepository: sr,
        evidenceLinkRepository: lr,
        idGenerator: id.gen,
      });
      return svc.generateSuggestions({ window: WINDOW });
    };

    const r1 = await run();
    const r2 = await run();

    expect(r1.length).toBe(r2.length);
    for (let i = 0; i < r1.length; i++) {
      expect(r1[i].suggestionType).toBe(r2[i].suggestionType);
      expect(r1[i].confidenceScore).toBe(r2[i].confidenceScore);
      expect(r1[i].proposedParameters).toEqual(r2[i].proposedParameters);
      expect(r1[i].evidenceSummary).toEqual(r2[i].evidenceSummary);
    }
  });
});

// ─── Fixture B: Repeated school-closure coverage ─────────────

describe('Fixture B — repeated school-closure coverage by one parent', () => {
  // Parent p1 covers all school closures for child c1 across 4 weeks
  const overlays: OverlayCoverageRecord[] = [
    { overlayId: 'o1', familyId: 'fam-1', date: '2026-03-05', childId: 'c1', assignedParentId: 'p1', disruptionType: 'SCHOOL_CLOSURE' },
    { overlayId: 'o2', familyId: 'fam-1', date: '2026-03-12', childId: 'c1', assignedParentId: 'p1', disruptionType: 'SCHOOL_CLOSURE' },
    { overlayId: 'o3', familyId: 'fam-1', date: '2026-03-19', childId: 'c1', assignedParentId: 'p1', disruptionType: 'SCHOOL_CLOSURE' },
    { overlayId: 'o4', familyId: 'fam-1', date: '2026-03-26', childId: 'c1', assignedParentId: 'p1', disruptionType: 'SCHOOL_CLOSURE' },
  ];

  it('generates exactly 1 SCHOOL_CLOSURE_COVERAGE_PREFERENCE suggestion', async () => {
    const service = new PolicySuggestionService({
      extractors: [new OverlayCoverageEvidenceExtractor(overlays)],
      detectorRegistry: new PatternDetectorRegistry(),
      evidenceRepository: evidenceRepo,
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      idGenerator: ids.gen,
    });

    const suggestions = await service.generateSuggestions({ window: WINDOW });

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].suggestionType).toBe('SCHOOL_CLOSURE_COVERAGE_PREFERENCE');
  });

  it('suggestion has exact expected field values', async () => {
    const service = new PolicySuggestionService({
      extractors: [new OverlayCoverageEvidenceExtractor(overlays)],
      detectorRegistry: new PatternDetectorRegistry(),
      evidenceRepository: evidenceRepo,
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      idGenerator: ids.gen,
    });

    const suggestions = await service.generateSuggestions({ window: WINDOW });
    const s = suggestions[0];

    expect(s.confidenceScore).toBe(1);
    expect(s.status).toBe('PENDING_REVIEW');
    expect(s.familyId).toBe('fam-1');
    expect(s.proposedRuleType).toBe('ACTIVITY_COMMITMENT');
    expect(s.proposedPriority).toBe('SOFT');
    expect(s.proposedParameters).toEqual({
      activityLabel: 'school_closure_coverage',
      preferredResponsibleParentId: 'p1',
    });
    expect(s.proposedScope).toEqual({ scopeType: 'CHILD', childId: 'c1' });
  });

  it('linked evidence count is 4 with correct IDs', async () => {
    const service = new PolicySuggestionService({
      extractors: [new OverlayCoverageEvidenceExtractor(overlays)],
      detectorRegistry: new PatternDetectorRegistry(),
      evidenceRepository: evidenceRepo,
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      idGenerator: ids.gen,
    });

    const suggestions = await service.generateSuggestions({ window: WINDOW });
    const links = await linkRepo.findBySuggestionId(suggestions[0].suggestionId);

    expect(links).toHaveLength(4);
    const linkedIds = links.map(l => l.evidenceId).sort();
    expect(linkedIds).toEqual(['overlay-o1', 'overlay-o2', 'overlay-o3', 'overlay-o4']);
  });

  it('evidence summary has correct occurrence count and deterministic examples', async () => {
    const service = new PolicySuggestionService({
      extractors: [new OverlayCoverageEvidenceExtractor(overlays)],
      detectorRegistry: new PatternDetectorRegistry(),
      evidenceRepository: evidenceRepo,
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      idGenerator: ids.gen,
    });

    const suggestions = await service.generateSuggestions({ window: WINDOW });
    const summary = suggestions[0].evidenceSummary;

    expect(summary.occurrenceCount).toBe(4);
    expect(summary.windowStart).toBe('2026-03-01');
    expect(summary.windowEnd).toBe('2026-03-31');
    expect(summary.representativeExamples).toHaveLength(4);
    expect(summary.representativeExamples.map(e => e.date)).toEqual([
      '2026-03-05', '2026-03-12', '2026-03-19', '2026-03-26',
    ]);

    for (const ex of summary.representativeExamples) {
      expect(ex.data.assignedParentId).toBe('p1');
      expect(ex.data.disruptionType).toBe('SCHOOL_CLOSURE');
    }
  });

  it('review bundle reflects correct evidence and proposed rule', async () => {
    const service = new PolicySuggestionService({
      extractors: [new OverlayCoverageEvidenceExtractor(overlays)],
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

    const bundle = await reviewService.getReviewBundle(suggestions[0].suggestionId);

    expect(bundle.suggestionType).toBe('SCHOOL_CLOSURE_COVERAGE_PREFERENCE');
    expect(bundle.confidenceScore).toBe(1);

    const countArtifact = bundle.artifacts.find(a => a.type === 'EVIDENCE_COUNT_SUMMARY')!;
    expect(countArtifact.data.totalEvidenceCount).toBe(4);
    expect(countArtifact.data.evidenceTypes).toEqual({ OVERLAY_COVERAGE: 4 });

    const ruleArtifact = bundle.artifacts.find(a => a.type === 'PROPOSED_RULE')!;
    expect(ruleArtifact.data.ruleType).toBe('ACTIVITY_COMMITMENT');
    expect(ruleArtifact.data.parameters).toEqual({
      activityLabel: 'school_closure_coverage',
      preferredResponsibleParentId: 'p1',
    });
  });

  it('accepting creates correct ACTIVITY_COMMITMENT policy rule', async () => {
    const service = new PolicySuggestionService({
      extractors: [new OverlayCoverageEvidenceExtractor(overlays)],
      detectorRegistry: new PatternDetectorRegistry(),
      evidenceRepository: evidenceRepo,
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      idGenerator: ids.gen,
    });

    const suggestions = await service.generateSuggestions({ window: WINDOW });
    expect(policyRepo.rules).toHaveLength(0);

    const workflow = new PolicySuggestionResolutionWorkflow({
      suggestionRepository: suggestionRepo,
      policyRuleRepository: policyRepo,
      idGenerator: ids.gen,
    });

    const result = await workflow.resolveSuggestion({
      suggestionId: suggestions[0].suggestionId,
      decision: 'ACCEPT',
      resolvedAt: '2026-03-28T14:00:00Z',
      resolvedBy: 'parent-p2',
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
      activityLabel: 'school_closure_coverage',
      preferredResponsibleParentId: 'p1',
    });
    expect(rule!.scope.scopeType).toBe('CHILD');
    expect(rule!.scope.childId).toBe('c1');

    const updated = await suggestionRepo.findById(suggestions[0].suggestionId);
    expect(updated!.status).toBe('ACCEPTED');
    expect(updated!.resolvedAt).toBe('2026-03-28T14:00:00Z');
    expect(updated!.resolvedBy).toBe('parent-p2');
  });
});

// ─── Fixture C: Repeated longer accepted blocks ──────────────

describe('Fixture C — repeated longer accepted blocks', () => {
  // 4 accepted proposals where child c1 always gets 3-night blocks with p1
  // and 4-night blocks with p2. All avg >= 3, so threshold=3 at 100%.
  const proposals: AcceptedProposalRecord[] = [
    {
      proposalId: 'prop-1',
      familyId: 'fam-1',
      acceptedAt: '2026-03-02T10:00:00Z',
      acceptedByParentId: 'p1',
      scheduleNights: [
        { date: '2026-03-03', childId: 'c1', parentId: 'p1' },
        { date: '2026-03-04', childId: 'c1', parentId: 'p1' },
        { date: '2026-03-05', childId: 'c1', parentId: 'p1' },
        { date: '2026-03-06', childId: 'c1', parentId: 'p2' },
        { date: '2026-03-07', childId: 'c1', parentId: 'p2' },
        { date: '2026-03-08', childId: 'c1', parentId: 'p2' },
      ],
    },
    {
      proposalId: 'prop-2',
      familyId: 'fam-1',
      acceptedAt: '2026-03-09T10:00:00Z',
      acceptedByParentId: 'p1',
      scheduleNights: [
        { date: '2026-03-10', childId: 'c1', parentId: 'p1' },
        { date: '2026-03-11', childId: 'c1', parentId: 'p1' },
        { date: '2026-03-12', childId: 'c1', parentId: 'p1' },
        { date: '2026-03-13', childId: 'c1', parentId: 'p2' },
        { date: '2026-03-14', childId: 'c1', parentId: 'p2' },
        { date: '2026-03-15', childId: 'c1', parentId: 'p2' },
      ],
    },
    {
      proposalId: 'prop-3',
      familyId: 'fam-1',
      acceptedAt: '2026-03-16T10:00:00Z',
      acceptedByParentId: 'p2',
      scheduleNights: [
        { date: '2026-03-17', childId: 'c1', parentId: 'p1' },
        { date: '2026-03-18', childId: 'c1', parentId: 'p1' },
        { date: '2026-03-19', childId: 'c1', parentId: 'p1' },
        { date: '2026-03-20', childId: 'c1', parentId: 'p2' },
        { date: '2026-03-21', childId: 'c1', parentId: 'p2' },
        { date: '2026-03-22', childId: 'c1', parentId: 'p2' },
      ],
    },
    {
      proposalId: 'prop-4',
      familyId: 'fam-1',
      acceptedAt: '2026-03-23T10:00:00Z',
      acceptedByParentId: 'p1',
      scheduleNights: [
        { date: '2026-03-24', childId: 'c1', parentId: 'p1' },
        { date: '2026-03-25', childId: 'c1', parentId: 'p1' },
        { date: '2026-03-26', childId: 'c1', parentId: 'p1' },
        { date: '2026-03-27', childId: 'c1', parentId: 'p2' },
        { date: '2026-03-28', childId: 'c1', parentId: 'p2' },
        { date: '2026-03-29', childId: 'c1', parentId: 'p2' },
      ],
    },
  ];

  it('generates exactly 1 MIN_BLOCK_LENGTH_ADJUSTMENT suggestion', async () => {
    const service = new PolicySuggestionService({
      extractors: [new AcceptedProposalEvidenceExtractor(proposals)],
      detectorRegistry: new PatternDetectorRegistry(),
      evidenceRepository: evidenceRepo,
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      idGenerator: ids.gen,
    });

    const suggestions = await service.generateSuggestions({ window: WINDOW });

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].suggestionType).toBe('MIN_BLOCK_LENGTH_ADJUSTMENT');
  });

  it('proposed parameters match expected nights=3 with confidence=1', async () => {
    const service = new PolicySuggestionService({
      extractors: [new AcceptedProposalEvidenceExtractor(proposals)],
      detectorRegistry: new PatternDetectorRegistry(),
      evidenceRepository: evidenceRepo,
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      idGenerator: ids.gen,
    });

    const suggestions = await service.generateSuggestions({ window: WINDOW });
    const s = suggestions[0];

    // All 8 evidence records have avg block length = 3
    // Threshold 3 meets 100% dominance → confidence 1.0
    expect(s.confidenceScore).toBe(1);
    expect(s.proposedRuleType).toBe('MIN_BLOCK_LENGTH');
    expect(s.proposedPriority).toBe('SOFT');
    expect(s.proposedParameters).toEqual({ nights: 3 });
    expect(s.proposedScope).toEqual({ scopeType: 'FAMILY' });
  });

  it('evidence summary has 8 records, 5 representative examples', async () => {
    const service = new PolicySuggestionService({
      extractors: [new AcceptedProposalEvidenceExtractor(proposals)],
      detectorRegistry: new PatternDetectorRegistry(),
      evidenceRepository: evidenceRepo,
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      idGenerator: ids.gen,
    });

    const suggestions = await service.generateSuggestions({ window: WINDOW });
    const summary = suggestions[0].evidenceSummary;

    // 4 proposals x 2 child-parent pairs each = 8 evidence records
    expect(summary.occurrenceCount).toBe(8);
    // Capped at 5 representative examples
    expect(summary.representativeExamples).toHaveLength(5);

    // First 5 sorted by date then evidenceId:
    // prop-1-block-c1-p1 (2026-03-02), prop-1-block-c1-p2 (2026-03-02),
    // prop-2-block-c1-p1 (2026-03-09), prop-2-block-c1-p2 (2026-03-09),
    // prop-3-block-c1-p1 (2026-03-16)
    const exDates = summary.representativeExamples.map(e => e.date);
    expect(exDates).toEqual([
      '2026-03-02', '2026-03-02',
      '2026-03-09', '2026-03-09',
      '2026-03-16',
    ]);
  });

  it('review bundle shows correct evidence count and proposed rule', async () => {
    const service = new PolicySuggestionService({
      extractors: [new AcceptedProposalEvidenceExtractor(proposals)],
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

    const bundle = await reviewService.getReviewBundle(suggestions[0].suggestionId);

    expect(bundle.suggestionType).toBe('MIN_BLOCK_LENGTH_ADJUSTMENT');
    expect(bundle.confidenceScore).toBe(1);

    const countArtifact = bundle.artifacts.find(a => a.type === 'EVIDENCE_COUNT_SUMMARY')!;
    expect(countArtifact.data.totalEvidenceCount).toBe(8);
    expect(countArtifact.data.evidenceTypes).toEqual({ ACCEPTED_PROPOSAL: 8 });

    const ruleArtifact = bundle.artifacts.find(a => a.type === 'PROPOSED_RULE')!;
    expect(ruleArtifact.data.ruleType).toBe('MIN_BLOCK_LENGTH');
    expect(ruleArtifact.data.parameters).toEqual({ nights: 3 });
  });

  it('accepting creates the expected MIN_BLOCK_LENGTH policy rule', async () => {
    const service = new PolicySuggestionService({
      extractors: [new AcceptedProposalEvidenceExtractor(proposals)],
      detectorRegistry: new PatternDetectorRegistry(),
      evidenceRepository: evidenceRepo,
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      idGenerator: ids.gen,
    });

    const suggestions = await service.generateSuggestions({ window: WINDOW });

    const workflow = new PolicySuggestionResolutionWorkflow({
      suggestionRepository: suggestionRepo,
      policyRuleRepository: policyRepo,
      idGenerator: ids.gen,
    });

    const result = await workflow.resolveSuggestion({
      suggestionId: suggestions[0].suggestionId,
      decision: 'ACCEPT',
      resolvedAt: '2026-03-30T09:00:00Z',
      resolvedBy: 'parent-p1',
    });

    expect(result.status).toBe('ACCEPTED');

    const rule = await policyRepo.findById(result.createdPolicyRuleId!);
    expect(rule).not.toBeNull();
    expect(rule!.ruleType).toBe('MIN_BLOCK_LENGTH');
    expect(rule!.priority).toBe('SOFT');
    expect(rule!.active).toBe(true);
    expect(rule!.familyId).toBe('fam-1');
    expect(rule!.parameters).toEqual({ nights: 3 });
    expect(rule!.scope.scopeType).toBe('FAMILY');
    expect(rule!.label).toBe('Auto-suggested: MIN_BLOCK_LENGTH_ADJUSTMENT');

    const updated = await suggestionRepo.findById(suggestions[0].suggestionId);
    expect(updated!.status).toBe('ACCEPTED');
  });
});

// ─── Fixture D: Conflicting or weak evidence ─────────────────

describe('Fixture D — conflicting or weak evidence produces no suggestions', () => {
  it('exchanges on mixed days and locations generate no suggestions', async () => {
    // 2 Monday, 1 Wednesday, 1 Friday — no day reaches 3 occurrences
    // 4 different locations — no location reaches 3 occurrences
    const mixedExchanges: ExchangeRecord[] = [
      { exchangeId: 'e1', familyId: 'fam-1', date: '2026-03-02', childId: 'c1', fromParentId: 'p1', toParentId: 'p2', time: '09:00', location: 'School' },
      { exchangeId: 'e2', familyId: 'fam-1', date: '2026-03-04', childId: 'c1', fromParentId: 'p2', toParentId: 'p1', time: '17:00', location: 'Park' },
      { exchangeId: 'e3', familyId: 'fam-1', date: '2026-03-06', childId: 'c1', fromParentId: 'p1', toParentId: 'p2', time: '12:00', location: 'Home' },
      { exchangeId: 'e4', familyId: 'fam-1', date: '2026-03-09', childId: 'c1', fromParentId: 'p2', toParentId: 'p1', time: '10:00', location: 'Library' },
    ];

    const service = new PolicySuggestionService({
      extractors: [new ExchangePatternEvidenceExtractor(mixedExchanges)],
      detectorRegistry: new PatternDetectorRegistry(),
      evidenceRepository: evidenceRepo,
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      idGenerator: ids.gen,
    });

    const suggestions = await service.generateSuggestions({ window: WINDOW });

    expect(suggestions).toHaveLength(0);
    expect(suggestionRepo.suggestions).toHaveLength(0);
  });

  it('overlays split evenly between parents generate no coverage suggestion', async () => {
    // 2 by p1, 2 by p2 — neither reaches 70% dominance (50% each)
    const splitOverlays: OverlayCoverageRecord[] = [
      { overlayId: 'o1', familyId: 'fam-1', date: '2026-03-05', childId: 'c1', assignedParentId: 'p1', disruptionType: 'SCHOOL_CLOSURE' },
      { overlayId: 'o2', familyId: 'fam-1', date: '2026-03-12', childId: 'c1', assignedParentId: 'p2', disruptionType: 'SCHOOL_CLOSURE' },
      { overlayId: 'o3', familyId: 'fam-1', date: '2026-03-19', childId: 'c1', assignedParentId: 'p1', disruptionType: 'SCHOOL_CLOSURE' },
      { overlayId: 'o4', familyId: 'fam-1', date: '2026-03-26', childId: 'c1', assignedParentId: 'p2', disruptionType: 'SCHOOL_CLOSURE' },
    ];

    const service = new PolicySuggestionService({
      extractors: [new OverlayCoverageEvidenceExtractor(splitOverlays)],
      detectorRegistry: new PatternDetectorRegistry(),
      evidenceRepository: evidenceRepo,
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      idGenerator: ids.gen,
    });

    const suggestions = await service.generateSuggestions({ window: WINDOW });

    expect(suggestions).toHaveLength(0);
  });

  it('too few exchanges (below MIN_OCCURRENCES=3) generate no suggestions', async () => {
    const fewExchanges: ExchangeRecord[] = [
      { exchangeId: 'e1', familyId: 'fam-1', date: '2026-03-01', childId: 'c1', fromParentId: 'p1', toParentId: 'p2', time: '09:00', location: 'School' },
      { exchangeId: 'e2', familyId: 'fam-1', date: '2026-03-08', childId: 'c1', fromParentId: 'p2', toParentId: 'p1', time: '09:00', location: 'School' },
    ];

    const service = new PolicySuggestionService({
      extractors: [new ExchangePatternEvidenceExtractor(fewExchanges)],
      detectorRegistry: new PatternDetectorRegistry(),
      evidenceRepository: evidenceRepo,
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      idGenerator: ids.gen,
    });

    const suggestions = await service.generateSuggestions({ window: WINDOW });

    expect(suggestions).toHaveLength(0);
  });

  it('proposals with short 1-night blocks generate no block length suggestion', async () => {
    // Each proposal has only 1-night blocks → avg=1 → floor(1)=1 < 2 threshold
    const shortProposals: AcceptedProposalRecord[] = [
      {
        proposalId: 'sp-1', familyId: 'fam-1', acceptedAt: '2026-03-02T10:00:00Z', acceptedByParentId: 'p1',
        scheduleNights: [
          { date: '2026-03-03', childId: 'c1', parentId: 'p1' },
          { date: '2026-03-04', childId: 'c1', parentId: 'p2' },
          { date: '2026-03-05', childId: 'c1', parentId: 'p1' },
        ],
      },
      {
        proposalId: 'sp-2', familyId: 'fam-1', acceptedAt: '2026-03-09T10:00:00Z', acceptedByParentId: 'p1',
        scheduleNights: [
          { date: '2026-03-10', childId: 'c1', parentId: 'p1' },
          { date: '2026-03-11', childId: 'c1', parentId: 'p2' },
          { date: '2026-03-12', childId: 'c1', parentId: 'p1' },
        ],
      },
      {
        proposalId: 'sp-3', familyId: 'fam-1', acceptedAt: '2026-03-16T10:00:00Z', acceptedByParentId: 'p2',
        scheduleNights: [
          { date: '2026-03-17', childId: 'c1', parentId: 'p1' },
          { date: '2026-03-18', childId: 'c1', parentId: 'p2' },
          { date: '2026-03-19', childId: 'c1', parentId: 'p1' },
        ],
      },
    ];

    const service = new PolicySuggestionService({
      extractors: [new AcceptedProposalEvidenceExtractor(shortProposals)],
      detectorRegistry: new PatternDetectorRegistry(),
      evidenceRepository: evidenceRepo,
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      idGenerator: ids.gen,
    });

    const suggestions = await service.generateSuggestions({ window: WINDOW });

    expect(suggestions).toHaveLength(0);
  });

  it('no pending review bundles exist when no suggestions generated', async () => {
    const mixedExchanges: ExchangeRecord[] = [
      { exchangeId: 'e1', familyId: 'fam-1', date: '2026-03-02', childId: 'c1', fromParentId: 'p1', toParentId: 'p2', time: '09:00', location: 'School' },
      { exchangeId: 'e2', familyId: 'fam-1', date: '2026-03-04', childId: 'c1', fromParentId: 'p2', toParentId: 'p1', time: '17:00', location: 'Park' },
      { exchangeId: 'e3', familyId: 'fam-1', date: '2026-03-06', childId: 'c1', fromParentId: 'p1', toParentId: 'p2', time: '12:00', location: 'Home' },
      { exchangeId: 'e4', familyId: 'fam-1', date: '2026-03-09', childId: 'c1', fromParentId: 'p2', toParentId: 'p1', time: '10:00', location: 'Library' },
    ];

    const service = new PolicySuggestionService({
      extractors: [new ExchangePatternEvidenceExtractor(mixedExchanges)],
      detectorRegistry: new PatternDetectorRegistry(),
      evidenceRepository: evidenceRepo,
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      idGenerator: ids.gen,
    });

    await service.generateSuggestions({ window: WINDOW });

    const reviewService = new PolicySuggestionReviewService({
      suggestionRepository: suggestionRepo,
      evidenceLinkRepository: linkRepo,
      evidenceRepository: evidenceRepo,
    });

    const bundles = await reviewService.getPendingReviewBundles('fam-1');
    expect(bundles).toHaveLength(0);

    expect(policyRepo.rules).toHaveLength(0);
  });
});
