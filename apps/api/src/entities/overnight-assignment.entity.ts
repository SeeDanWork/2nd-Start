import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { BaseScheduleVersion } from './base-schedule-version.entity';

@Entity('overnight_assignments')
@Unique(['scheduleVersionId', 'date'])
@Index('idx_overnight_family_date', ['familyId', 'date'])
export class OvernightAssignment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'schedule_version_id' })
  scheduleVersionId!: string;

  @Column({ type: 'uuid', name: 'family_id' })
  familyId!: string;

  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'text', name: 'assigned_to' })
  assignedTo!: string;

  @Column({ type: 'boolean', name: 'is_transition' })
  isTransition!: boolean;

  @Column({ type: 'text', default: 'generated' })
  source!: string;

  @ManyToOne(() => BaseScheduleVersion, (v) => v.assignments)
  @JoinColumn({ name: 'schedule_version_id' })
  scheduleVersion!: BaseScheduleVersion;
}
