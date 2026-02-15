import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('audit_log')
@Index('idx_audit_family_time', ['familyId', 'createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('increment')
  id!: number;

  @Column({ type: 'uuid', name: 'family_id' })
  familyId!: string;

  @Column({ type: 'uuid', name: 'actor_id', nullable: true })
  actorId!: string | null;

  @Column({ type: 'text' })
  action!: string;

  @Column({ type: 'text', name: 'entity_type' })
  entityType!: string;

  @Column({ type: 'uuid', name: 'entity_id' })
  entityId!: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
