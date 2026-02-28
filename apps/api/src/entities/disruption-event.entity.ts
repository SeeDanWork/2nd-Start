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
