import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm';

@Entity('stability_snapshots')
export class StabilitySnapshot {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'family_id' })
  familyId!: string;

  @Column({ type: 'uuid', name: 'schedule_version_id' })
  scheduleVersionId!: string;

  @Column({ type: 'date', name: 'window_start' })
  windowStart!: string;

  @Column({ type: 'date', name: 'window_end' })
  windowEnd!: string;

  @Column({ type: 'float', name: 'transitions_per_week' })
  transitionsPerWeek!: number;

  @Column({ type: 'int', name: 'max_consecutive_a' })
  maxConsecutiveA!: number;

  @Column({ type: 'int', name: 'max_consecutive_b' })
  maxConsecutiveB!: number;

  @Column({ type: 'float', name: 'school_night_consistency_pct' })
  schoolNightConsistencyPct!: number;

  @Column({ type: 'int', name: 'weekend_fragmentation_count' })
  weekendFragmentationCount!: number;

  @Column({ type: 'timestamptz', name: 'computed_at' })
  computedAt!: Date;
}
