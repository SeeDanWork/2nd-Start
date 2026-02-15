import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { OvernightAssignment } from './overnight-assignment.entity';
import { HandoffEvent } from './handoff-event.entity';

@Entity('base_schedule_versions')
@Index('idx_schedule_active', ['familyId'], { where: '"is_active" = true', unique: true })
export class BaseScheduleVersion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'family_id' })
  familyId!: string;

  @Column({ type: 'int' })
  version!: number;

  @Column({ type: 'int', name: 'constraint_set_version' })
  constraintSetVersion!: number;

  @Column({ type: 'date', name: 'horizon_start' })
  horizonStart!: string;

  @Column({ type: 'date', name: 'horizon_end' })
  horizonEnd!: string;

  @Column({ type: 'text', name: 'solver_status' })
  solverStatus!: string;

  @Column({ type: 'jsonb', name: 'solver_metadata', nullable: true })
  solverMetadata!: Record<string, unknown> | null;

  @Column({ type: 'text', name: 'created_by' })
  createdBy!: string;

  @Column({ type: 'uuid', name: 'source_proposal_option_id', nullable: true })
  sourceProposalOptionId!: string | null;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @OneToMany(() => OvernightAssignment, (a) => a.scheduleVersion)
  assignments!: OvernightAssignment[];

  @OneToMany(() => HandoffEvent, (h) => h.scheduleVersion)
  handoffs!: HandoffEvent[];
}
