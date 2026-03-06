import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('user_feedback')
@Index('idx_feedback_family', ['familyId'])
@Index('idx_feedback_request', ['requestId'])
export class UserFeedback {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'family_id' })
  familyId!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'uuid', name: 'request_id', nullable: true })
  requestId!: string | null;

  @Column({ type: 'uuid', name: 'proposal_option_id', nullable: true })
  proposalOptionId!: string | null;

  @Column({ type: 'text' })
  category!: string;

  @Column({ type: 'smallint' })
  severity!: number;

  @Column({ type: 'text', name: 'free_text', nullable: true })
  freeText!: string | null;

  @Column({ type: 'smallint', name: 'objection_round', default: 0 })
  objectionRound!: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
