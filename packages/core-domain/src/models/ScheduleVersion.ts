import { ScheduleId, FamilyId } from '../types';
import { ScheduleStatus } from '../enums';

export interface ScheduleVersion {
  id: ScheduleId;
  familyId: FamilyId;
  baselineVersionId: ScheduleId | null;
  status: ScheduleStatus;
  startDate: string; // ISO date YYYY-MM-DD
  endDate: string;   // ISO date YYYY-MM-DD
  createdAt: Date;
  solverRunId: string | null;
  activatedAt: Date | null;
  archivedAt: Date | null;
  derivedFromProposalId: string | null;
  versionNumber: number;
}

export function createScheduleVersion(
  id: ScheduleId,
  familyId: FamilyId,
  startDate: string,
  endDate: string,
  versionNumber: number,
  baselineVersionId?: ScheduleId | null,
  solverRunId?: string | null,
  derivedFromProposalId?: string | null,
): ScheduleVersion {
  if (startDate >= endDate) {
    throw new Error('Start date must be before end date');
  }
  if (versionNumber < 1) {
    throw new Error('Version number must be >= 1');
  }
  return {
    id,
    familyId,
    baselineVersionId: baselineVersionId ?? null,
    status: ScheduleStatus.ACTIVE,
    startDate,
    endDate,
    createdAt: new Date(),
    solverRunId: solverRunId ?? null,
    activatedAt: null,
    archivedAt: null,
    derivedFromProposalId: derivedFromProposalId ?? null,
    versionNumber,
  };
}
