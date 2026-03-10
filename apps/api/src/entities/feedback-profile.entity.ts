import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

@Entity('feedback_profiles')
export class FeedbackProfile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'family_id', unique: true })
  familyId!: string;

  @Column({ type: 'int', name: 'feedback_count', default: 0 })
  feedbackCount!: number;

  @Column({ type: 'jsonb', name: 'accumulated_deltas', default: () => "'{}'::jsonb" })
  accumulatedDeltas!: Record<string, number>;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
