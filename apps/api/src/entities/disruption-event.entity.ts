import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('disruption_events')
@Index('idx_disruption_family_dates', ['familyId', 'startDate', 'endDate'])
@Index('idx_disruption_family_date', ['familyId', 'date'])
export class DisruptionEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'family_id' })
  familyId!: string;

  @Column({ type: 'text' })
  type!: string;

  @Column({ type: 'text', default: 'household' })
  scope!: string;

  @Column({ type: 'text', default: 'user_declared' })
  source!: string;

  @Column({ type: 'text', name: 'override_strength', default: 'none' })
  overrideStrength!: string;

  @Column({ type: 'date', name: 'start_date' })
  startDate!: string;

  @Column({ type: 'date', name: 'end_date' })
  endDate!: string;

  @Column({ type: 'date', nullable: true })
  date!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'text', name: 'child_name', nullable: true })
  childName!: string | null;

  @Column({ type: 'text', default: 'active' })
  status!: string;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  @Column({ type: 'uuid', name: 'reported_by', nullable: true })
  reportedBy!: string | null;

  @Column({ type: 'timestamptz', name: 'resolved_at', nullable: true })
  resolvedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
