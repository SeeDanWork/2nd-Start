import { NightOwnership } from './NightOwnership';
import { Exchange } from './Exchange';

export interface ScheduleSnapshot {
  scheduleVersionId: string;
  familyId: string;
  startDate: string;
  endDate: string;
  nights: NightOwnership[];
  exchanges: Exchange[];
}
