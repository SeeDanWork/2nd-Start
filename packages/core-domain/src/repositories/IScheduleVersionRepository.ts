import { ScheduleVersion } from '../models/ScheduleVersion';

export interface IScheduleVersionRepository {
  findById(id: string): Promise<ScheduleVersion | null>;
  findActiveByFamilyId(familyId: string): Promise<ScheduleVersion | null>;
  getNextVersionNumber(familyId: string): Promise<number>;
  create(version: ScheduleVersion): Promise<ScheduleVersion>;
  activate(id: string, activatedAt: Date): Promise<void>;
  archive(id: string, archivedAt: Date): Promise<void>;
}
