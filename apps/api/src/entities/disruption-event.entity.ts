import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('disruption_events')
@Index('idx_disruption_family_date', ['familyId', 'date'])
export class DisruptionEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'family_id' })
  familyId!: string;

  @Column({ type: 'uuid', name: 'reported_by' })
  reportedBy!: string;

  @Column({ type: 'text' })
  type!: string;

  @Column({ type: 'date' })
  date!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'text', name: 'child_name', nullable: true })
  childName!: string | null;

  @Column({ type: 'text', default: 'active' })
  status!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
