import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseScheduleVersion } from './base-schedule-version.entity';

@Entity('handoff_events')
@Index('idx_handoff_family_date', ['familyId', 'date'])
export class HandoffEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'schedule_version_id' })
  scheduleVersionId!: string;

  @Column({ type: 'uuid', name: 'family_id' })
  familyId!: string;

  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'text' })
  type!: string;

  @Column({ type: 'time', name: 'time_window_start', nullable: true })
  timeWindowStart!: string | null;

  @Column({ type: 'time', name: 'time_window_end', nullable: true })
  timeWindowEnd!: string | null;

  @Column({ type: 'uuid', name: 'location_id', nullable: true })
  locationId!: string | null;

  @Column({ type: 'text', name: 'from_parent' })
  fromParent!: string;

  @Column({ type: 'text', name: 'to_parent' })
  toParent!: string;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @ManyToOne(() => BaseScheduleVersion, (v) => v.handoffs)
  @JoinColumn({ name: 'schedule_version_id' })
  scheduleVersion!: BaseScheduleVersion;
}
