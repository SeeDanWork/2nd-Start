import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('policy_decision_records')
@Index('idx_decision_family_event', ['familyId', 'disruptionEventId'])
export class PolicyDecisionRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'family_id' })
  familyId!: string;

  @Column({ type: 'uuid', name: 'disruption_event_id' })
  disruptionEventId!: string;

  @Column({ type: 'uuid', name: 'policy_id' })
  policyId!: string;

  @Column({ type: 'text', name: 'action_taken' })
  actionTaken!: string;

  @Column({ type: 'boolean', nullable: true })
  accepted!: boolean | null;

  @Column({ type: 'uuid', name: 'decided_by', nullable: true })
  decidedBy!: string | null;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
