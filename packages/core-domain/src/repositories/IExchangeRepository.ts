import { Exchange } from '../models/Exchange';

export interface IExchangeRepository {
  findByScheduleId(scheduleId: string): Promise<Exchange[]>;
  createMany(exchanges: Exchange[]): Promise<void>;
}
