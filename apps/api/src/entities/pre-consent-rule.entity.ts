import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('pre_consent_rules')
export class PreConsentRule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'family_id' })
  familyId!: string;

  @Column({ type: 'uuid', name: 'created_by' })
  createdBy!: string;

  @Column({ type: 'text', name: 'rule_type' })
  ruleType!: string;

  @Column({ type: 'jsonb' })
  threshold!: Record<string, unknown>;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
