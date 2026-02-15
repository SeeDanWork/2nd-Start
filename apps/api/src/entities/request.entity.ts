import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('requests')
@Index('idx_request_family_status', ['familyId', 'status'])
export class Request {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'family_id' })
  familyId!: string;

  @Column({ type: 'uuid', name: 'requested_by' })
  requestedBy!: string;

  @Column({ type: 'text' })
  type!: string;

  @Column({ type: 'text', default: 'draft' })
  status!: string;

  @Column({ type: 'date', array: true })
  dates!: string[];

  @Column({ type: 'text', name: 'reason_tag', nullable: true })
  reasonTag!: string | null;

  @Column({ type: 'text', name: 'reason_note', nullable: true })
  reasonNote!: string | null;

  @Column({ type: 'text', default: 'normal' })
  urgency!: string;

  @Column({ type: 'int', name: 'change_budget_debit', default: 1 })
  changeBudgetDebit!: number;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt!: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
