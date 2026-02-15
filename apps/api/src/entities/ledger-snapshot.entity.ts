import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
} from 'typeorm';

@Entity('ledger_snapshots')
@Index('idx_ledger_family_window', ['familyId', 'windowType', 'windowEnd'])
export class LedgerSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'family_id' })
  familyId!: string;

  @Column({ type: 'uuid', name: 'schedule_version_id' })
  scheduleVersionId!: string;

  @Column({ type: 'text', name: 'window_type' })
  windowType!: string;

  @Column({ type: 'date', name: 'window_start' })
  windowStart!: string;

  @Column({ type: 'date', name: 'window_end' })
  windowEnd!: string;

  @Column({ type: 'int', name: 'parent_a_overnights' })
  parentAOvernights!: number;

  @Column({ type: 'int', name: 'parent_b_overnights' })
  parentBOvernights!: number;

  @Column({ type: 'int', name: 'parent_a_weekend_nights' })
  parentAWeekendNights!: number;

  @Column({ type: 'int', name: 'parent_b_weekend_nights' })
  parentBWeekendNights!: number;

  @Column({ type: 'boolean', name: 'within_fairness_band' })
  withinFairnessBand!: boolean;

  @Column({ type: 'timestamptz', name: 'computed_at' })
  computedAt!: Date;
}
