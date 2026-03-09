import { NightOwnership } from '../models/NightOwnership';

export interface INightOwnershipRepository {
  findByScheduleId(scheduleId: string): Promise<NightOwnership[]>;
  createMany(nights: NightOwnership[]): Promise<void>;
}
