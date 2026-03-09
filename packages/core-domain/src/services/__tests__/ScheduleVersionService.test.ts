import { describe, it, expect, beforeEach } from 'vitest';
import { ScheduleVersionService } from '../ScheduleVersionService';
import { ScheduleStatus } from '../../enums/ScheduleStatus';
import { ScheduleId, FamilyId } from '../../types';
import {
  InMemoryScheduleVersionRepository,
  InMemoryNightOwnershipRepository,
  InMemoryExchangeRepository,
  FAMILY_ID, PARENT_A, PARENT_B, CHILD_1,
  makeNight, makeExchange,
} from './helpers';

describe('ScheduleVersionService', () => {
  let scheduleRepo: InMemoryScheduleVersionRepository;
  let nightRepo: InMemoryNightOwnershipRepository;
  let exchangeRepo: InMemoryExchangeRepository;
  let service: ScheduleVersionService;

  beforeEach(() => {
    scheduleRepo = new InMemoryScheduleVersionRepository();
    nightRepo = new InMemoryNightOwnershipRepository();
    exchangeRepo = new InMemoryExchangeRepository();
    service = new ScheduleVersionService(scheduleRepo, nightRepo, exchangeRepo);
  });

  it('creates initial version with version_number = 1', async () => {
    const id = 'v1' as ScheduleId;
    const version = await service.createInitialVersion({
      id,
      familyId: FAMILY_ID,
      startDate: '2026-03-01',
      endDate: '2026-05-31',
      nights: [makeNight(id, '2026-03-01', CHILD_1, PARENT_A)],
      exchanges: [],
    });

    expect(version.versionNumber).toBe(1);
    expect(version.familyId).toBe(FAMILY_ID);
    expect(version.status).toBe(ScheduleStatus.ACTIVE);
    expect(version.baselineVersionId).toBeNull();
  });

  it('increments version number for same family', async () => {
    const v1 = await service.createInitialVersion({
      id: 'v1' as ScheduleId,
      familyId: FAMILY_ID,
      startDate: '2026-03-01',
      endDate: '2026-05-31',
      nights: [],
      exchanges: [],
    });

    const v2 = await service.createInitialVersion({
      id: 'v2' as ScheduleId,
      familyId: FAMILY_ID,
      startDate: '2026-03-01',
      endDate: '2026-05-31',
      nights: [],
      exchanges: [],
    });

    expect(v1.versionNumber).toBe(1);
    expect(v2.versionNumber).toBe(2);
  });

  it('enforces one active version per family', async () => {
    const v1 = await service.createInitialVersion({
      id: 'v1' as ScheduleId,
      familyId: FAMILY_ID,
      startDate: '2026-03-01',
      endDate: '2026-05-31',
      nights: [],
      exchanges: [],
    });
    await service.activateVersion(FAMILY_ID, 'v1');

    const v2 = await service.createInitialVersion({
      id: 'v2' as ScheduleId,
      familyId: FAMILY_ID,
      startDate: '2026-03-01',
      endDate: '2026-05-31',
      nights: [],
      exchanges: [],
    });
    await service.activateVersion(FAMILY_ID, 'v2');

    const allVersions = scheduleRepo.getAll();
    const active = allVersions.filter(v => v.status === ScheduleStatus.ACTIVE && v.activatedAt !== null);
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe('v2');

    const v1After = allVersions.find(v => v.id === 'v1')!;
    expect(v1After.status).toBe(ScheduleStatus.ARCHIVED);
    expect(v1After.archivedAt).not.toBeNull();
  });

  it('archives previous version on activation', async () => {
    await service.createInitialVersion({
      id: 'v1' as ScheduleId,
      familyId: FAMILY_ID,
      startDate: '2026-03-01',
      endDate: '2026-05-31',
      nights: [],
      exchanges: [],
    });
    await service.activateVersion(FAMILY_ID, 'v1');

    await service.createInitialVersion({
      id: 'v2' as ScheduleId,
      familyId: FAMILY_ID,
      startDate: '2026-03-01',
      endDate: '2026-05-31',
      nights: [],
      exchanges: [],
    });
    await service.activateVersion(FAMILY_ID, 'v2');

    const v1 = scheduleRepo.getAll().find(v => v.id === 'v1')!;
    expect(v1.status).toBe(ScheduleStatus.ARCHIVED);
    expect(v1.archivedAt).toBeInstanceOf(Date);
  });

  it('rejects cross-family activation', async () => {
    const otherFamily = 'family-other' as FamilyId;
    await service.createInitialVersion({
      id: 'v1' as ScheduleId,
      familyId: FAMILY_ID,
      startDate: '2026-03-01',
      endDate: '2026-05-31',
      nights: [],
      exchanges: [],
    });

    await expect(service.activateVersion(otherFamily, 'v1'))
      .rejects.toThrow('does not belong to family');
  });

  it('stores nights and exchanges with the version', async () => {
    const id = 'v1' as ScheduleId;
    await service.createInitialVersion({
      id,
      familyId: FAMILY_ID,
      startDate: '2026-03-01',
      endDate: '2026-05-31',
      nights: [
        makeNight(id, '2026-03-01', CHILD_1, PARENT_A),
        makeNight(id, '2026-03-02', CHILD_1, PARENT_B),
      ],
      exchanges: [
        makeExchange(id, '2026-03-02', CHILD_1, PARENT_A, PARENT_B),
      ],
    });

    const snapshot = await service.getScheduleSnapshot(id);
    expect(snapshot.nights).toHaveLength(2);
    expect(snapshot.exchanges).toHaveLength(1);
    expect(snapshot.familyId).toBe(FAMILY_ID);
  });

  it('throws on schedule not found', async () => {
    await expect(service.getScheduleSnapshot('nonexistent'))
      .rejects.toThrow('not found');
  });

  it('rejects activation of archived version', async () => {
    await service.createInitialVersion({
      id: 'v1' as ScheduleId,
      familyId: FAMILY_ID,
      startDate: '2026-03-01',
      endDate: '2026-05-31',
      nights: [],
      exchanges: [],
    });
    await service.activateVersion(FAMILY_ID, 'v1');

    await service.createInitialVersion({
      id: 'v2' as ScheduleId,
      familyId: FAMILY_ID,
      startDate: '2026-03-01',
      endDate: '2026-05-31',
      nights: [],
      exchanges: [],
    });
    await service.activateVersion(FAMILY_ID, 'v2');

    // v1 is now archived
    await expect(service.activateVersion(FAMILY_ID, 'v1'))
      .rejects.toThrow('Cannot activate archived');
  });
});
