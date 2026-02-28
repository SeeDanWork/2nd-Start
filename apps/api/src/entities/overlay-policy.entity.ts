import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('overlay_policies')
@Index('idx_policy_family_event', ['familyId', 'appliesToEventType'])
export class OverlayPolicyEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'family_id', nullable: true })
  familyId!: string | null;

  @Column({ type: 'text', name: 'applies_to_event_type' })
  appliesToEventType!: string;

  @Column({ type: 'text', name: 'action_type' })
  actionType!: string;

  @Column({ type: 'text', name: 'default_strength' })
  defaultStrength!: string;

  @Column({ type: 'jsonb', name: 'prompting_rules', default: {} })
  promptingRules!: Record<string, unknown>;

  @Column({ type: 'jsonb', name: 'fairness_accounting', default: {} })
  fairnessAccounting!: Record<string, unknown>;

  @Column({ type: 'text', default: 'global_default' })
  source!: string;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
