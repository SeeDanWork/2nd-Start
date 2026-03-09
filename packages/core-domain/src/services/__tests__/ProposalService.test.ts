import { describe, it, expect, beforeEach } from 'vitest';
import { ProposalService } from '../ProposalService';
import { ScheduleVersionService } from '../ScheduleVersionService';
import { ProposalStatus } from '../../enums/ProposalStatus';
import { ScheduleStatus } from '../../enums/ScheduleStatus';
import { ScheduleId } from '../../types';
import {
  InMemoryScheduleVersionRepository,
  InMemoryProposalRepository,
  InMemoryProposalScheduleRepository,
  InMemoryNightOwnershipRepository,
  InMemoryExchangeRepository,
  FAMILY_ID, PARENT_A, PARENT_B, CHILD_1,
  makeNight, makeProposalNight, makeProposalExchange,
} from './helpers';

describe('ProposalService', () => {
  let scheduleRepo: InMemoryScheduleVersionRepository;
  let proposalRepo: InMemoryProposalRepository;
  let proposalScheduleRepo: InMemoryProposalScheduleRepository;
  let nightRepo: InMemoryNightOwnershipRepository;
  let exchangeRepo: InMemoryExchangeRepository;
  let scheduleService: ScheduleVersionService;
  let service: ProposalService;

  const BASE_VERSION_ID = 'base-v1' as ScheduleId;

  async function setupActiveBaseVersion() {
    await scheduleService.createInitialVersion({
      id: BASE_VERSION_ID,
      familyId: FAMILY_ID,
      startDate: '2026-03-01',
      endDate: '2026-05-31',
      nights: [
        makeNight(BASE_VERSION_ID, '2026-03-01', CHILD_1, PARENT_A),
        makeNight(BASE_VERSION_ID, '2026-03-02', CHILD_1, PARENT_A),
        makeNight(BASE_VERSION_ID, '2026-03-03', CHILD_1, PARENT_B),
      ],
      exchanges: [],
    });
    await scheduleService.activateVersion(FAMILY_ID, BASE_VERSION_ID);
  }

  beforeEach(() => {
    scheduleRepo = new InMemoryScheduleVersionRepository();
    proposalRepo = new InMemoryProposalRepository();
    proposalScheduleRepo = new InMemoryProposalScheduleRepository();
    nightRepo = new InMemoryNightOwnershipRepository();
    exchangeRepo = new InMemoryExchangeRepository();
    scheduleService = new ScheduleVersionService(scheduleRepo, nightRepo, exchangeRepo);
    service = new ProposalService(
      proposalRepo, proposalScheduleRepo, scheduleRepo,
      nightRepo, exchangeRepo, scheduleService,
    );
  });

  it('creates proposal from active schedule', async () => {
    await setupActiveBaseVersion();

    const proposal = await service.createProposal({
      id: 'p1',
      baseScheduleVersionId: BASE_VERSION_ID,
      createdBy: 'parent-a',
      type: 'swap',
    });

    expect(proposal.status).toBe(ProposalStatus.PENDING);
    expect(proposal.baseScheduleVersionId).toBe(BASE_VERSION_ID);
  });

  it('attaches proposal schedule with nights and exchanges', async () => {
    await setupActiveBaseVersion();

    await service.createProposal({
      id: 'p1',
      baseScheduleVersionId: BASE_VERSION_ID,
      createdBy: 'parent-a',
      type: 'swap',
    });

    const ps = await service.attachProposalSchedule({
      id: 'ps1',
      proposalId: 'p1',
      scoreBreakdown: { fairnessScore: 0.9, stabilityScore: 0.8, transitionPenalty: 0.1, policyViolationPenalty: 0, totalScore: 0.85 },
      fairnessProjection: { parentANightDelta: -1, parentBNightDelta: 1, weekendParityDelta: 0, projectedDeviationAfter: 0.5 },
      stabilityDelta: -0.1,
      nights: [
        makeProposalNight('ps1', '2026-03-01', CHILD_1, PARENT_B), // changed from A to B
        makeProposalNight('ps1', '2026-03-02', CHILD_1, PARENT_A),
        makeProposalNight('ps1', '2026-03-03', CHILD_1, PARENT_B),
      ],
      exchanges: [
        makeProposalExchange('ps1', '2026-03-01', CHILD_1, PARENT_A, PARENT_B),
      ],
    });

    expect(ps.proposalId).toBe('p1');

    const snapshot = await service.getProposalSnapshot('p1');
    expect(snapshot.nights).toHaveLength(3);
    expect(snapshot.exchanges).toHaveLength(1);
  });

  it('accepts proposal into new version', async () => {
    await setupActiveBaseVersion();

    await service.createProposal({
      id: 'p1',
      baseScheduleVersionId: BASE_VERSION_ID,
      createdBy: 'parent-a',
      type: 'swap',
    });

    await service.attachProposalSchedule({
      id: 'ps1',
      proposalId: 'p1',
      scoreBreakdown: { fairnessScore: 0.9, stabilityScore: 0.8, transitionPenalty: 0.1, policyViolationPenalty: 0, totalScore: 0.85 },
      fairnessProjection: { parentANightDelta: -1, parentBNightDelta: 1, weekendParityDelta: 0, projectedDeviationAfter: 0.5 },
      stabilityDelta: -0.1,
      nights: [
        makeProposalNight('ps1', '2026-03-01', CHILD_1, PARENT_B),
        makeProposalNight('ps1', '2026-03-02', CHILD_1, PARENT_A),
        makeProposalNight('ps1', '2026-03-03', CHILD_1, PARENT_B),
      ],
      exchanges: [],
    });

    const newVersion = await service.acceptProposal('p1');

    expect(newVersion.derivedFromProposalId).toBe('p1');
    expect(newVersion.baselineVersionId).toBe(BASE_VERSION_ID);
    expect(newVersion.versionNumber).toBe(2);

    // Old version should be archived
    const oldVersion = scheduleRepo.getAll().find(v => v.id === BASE_VERSION_ID)!;
    expect(oldVersion.status).toBe(ScheduleStatus.ARCHIVED);

    // Proposal should be accepted
    const proposal = proposalRepo.getAll().find(p => p.id === 'p1')!;
    expect(proposal.status).toBe(ProposalStatus.ACCEPTED);
    expect(proposal.resolvedAt).not.toBeNull();
  });

  it('rejects stale proposal acceptance', async () => {
    await setupActiveBaseVersion();

    await service.createProposal({
      id: 'p1',
      baseScheduleVersionId: BASE_VERSION_ID,
      createdBy: 'parent-a',
      type: 'swap',
    });

    await service.attachProposalSchedule({
      id: 'ps1',
      proposalId: 'p1',
      scoreBreakdown: { fairnessScore: 0.9, stabilityScore: 0.8, transitionPenalty: 0.1, policyViolationPenalty: 0, totalScore: 0.85 },
      fairnessProjection: { parentANightDelta: 0, parentBNightDelta: 0, weekendParityDelta: 0, projectedDeviationAfter: 0 },
      stabilityDelta: 0,
      nights: [makeProposalNight('ps1', '2026-03-01', CHILD_1, PARENT_A)],
      exchanges: [],
    });

    // Create and activate a new version, making base stale
    await scheduleService.createInitialVersion({
      id: 'v-new' as ScheduleId,
      familyId: FAMILY_ID,
      startDate: '2026-03-01',
      endDate: '2026-05-31',
      nights: [],
      exchanges: [],
    });
    await scheduleService.activateVersion(FAMILY_ID, 'v-new');

    // Now base-v1 is archived, proposal p1 is stale
    await expect(service.acceptProposal('p1'))
      .rejects.toThrow('is stale');
  });

  it('invalidates sibling proposals after acceptance', async () => {
    await setupActiveBaseVersion();

    // Create two proposals on same base
    await service.createProposal({ id: 'p1', baseScheduleVersionId: BASE_VERSION_ID, createdBy: 'parent-a', type: 'swap' });
    await service.createProposal({ id: 'p2', baseScheduleVersionId: BASE_VERSION_ID, createdBy: 'parent-b', type: 'swap' });

    await service.attachProposalSchedule({
      id: 'ps1', proposalId: 'p1',
      scoreBreakdown: { fairnessScore: 0.9, stabilityScore: 0.8, transitionPenalty: 0.1, policyViolationPenalty: 0, totalScore: 0.85 },
      fairnessProjection: { parentANightDelta: 0, parentBNightDelta: 0, weekendParityDelta: 0, projectedDeviationAfter: 0 },
      stabilityDelta: 0,
      nights: [makeProposalNight('ps1', '2026-03-01', CHILD_1, PARENT_B)],
      exchanges: [],
    });

    await service.acceptProposal('p1');

    // p2 should be invalidated
    const p2 = proposalRepo.getAll().find(p => p.id === 'p2')!;
    expect(p2.status).toBe(ProposalStatus.EXPIRED);
    expect(p2.invalidatedReason).toContain('no longer active');
  });

  it('rejects double acceptance', async () => {
    await setupActiveBaseVersion();

    await service.createProposal({ id: 'p1', baseScheduleVersionId: BASE_VERSION_ID, createdBy: 'parent-a', type: 'swap' });
    await service.attachProposalSchedule({
      id: 'ps1', proposalId: 'p1',
      scoreBreakdown: { fairnessScore: 0.9, stabilityScore: 0.8, transitionPenalty: 0.1, policyViolationPenalty: 0, totalScore: 0.85 },
      fairnessProjection: { parentANightDelta: 0, parentBNightDelta: 0, weekendParityDelta: 0, projectedDeviationAfter: 0 },
      stabilityDelta: 0,
      nights: [makeProposalNight('ps1', '2026-03-01', CHILD_1, PARENT_B)],
      exchanges: [],
    });

    await service.acceptProposal('p1');

    // Second acceptance should fail
    await expect(service.acceptProposal('p1'))
      .rejects.toThrow('cannot be resolved');
  });

  it('rejects acceptance when proposal has no schedule contents', async () => {
    await setupActiveBaseVersion();

    await service.createProposal({ id: 'p1', baseScheduleVersionId: BASE_VERSION_ID, createdBy: 'parent-a', type: 'swap' });

    await expect(service.acceptProposal('p1'))
      .rejects.toThrow('no attached schedule');
  });

  it('rejects proposal', async () => {
    await setupActiveBaseVersion();

    await service.createProposal({ id: 'p1', baseScheduleVersionId: BASE_VERSION_ID, createdBy: 'parent-a', type: 'swap' });

    await service.rejectProposal('p1', 'Does not work for me');

    const proposal = proposalRepo.getAll().find(p => p.id === 'p1')!;
    expect(proposal.status).toBe(ProposalStatus.REJECTED);
    expect(proposal.resolvedAt).not.toBeNull();
    expect(proposal.invalidatedReason).toBe('Does not work for me');
  });

  it('expires proposal', async () => {
    await setupActiveBaseVersion();

    await service.createProposal({ id: 'p1', baseScheduleVersionId: BASE_VERSION_ID, createdBy: 'parent-a', type: 'swap' });

    await service.expireProposal('p1');

    const proposal = proposalRepo.getAll().find(p => p.id === 'p1')!;
    expect(proposal.status).toBe(ProposalStatus.EXPIRED);
  });

  it('cannot reject already accepted proposal', async () => {
    await setupActiveBaseVersion();

    await service.createProposal({ id: 'p1', baseScheduleVersionId: BASE_VERSION_ID, createdBy: 'parent-a', type: 'swap' });
    await service.attachProposalSchedule({
      id: 'ps1', proposalId: 'p1',
      scoreBreakdown: { fairnessScore: 0.9, stabilityScore: 0.8, transitionPenalty: 0.1, policyViolationPenalty: 0, totalScore: 0.85 },
      fairnessProjection: { parentANightDelta: 0, parentBNightDelta: 0, weekendParityDelta: 0, projectedDeviationAfter: 0 },
      stabilityDelta: 0,
      nights: [makeProposalNight('ps1', '2026-03-01', CHILD_1, PARENT_B)],
      exchanges: [],
    });

    await service.acceptProposal('p1');

    await expect(service.rejectProposal('p1'))
      .rejects.toThrow('cannot be resolved');
  });
});
