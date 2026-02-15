import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { ConstraintSet } from './constraint-set.entity';

@Entity('constraints')
export class Constraint {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'constraint_set_id' })
  constraintSetId!: string;

  @Column({ type: 'text' })
  type!: string;

  @Column({ type: 'text', default: 'hard' })
  hardness!: string;

  @Column({ type: 'int', default: 100 })
  weight!: number;

  @Column({ type: 'text' })
  owner!: string;

  @Column({ type: 'jsonb', nullable: true })
  recurrence!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', name: 'date_range', nullable: true })
  dateRange!: Record<string, unknown> | null;

  @Column({ type: 'jsonb' })
  parameters!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @ManyToOne(() => ConstraintSet, (cs) => cs.constraints)
  @JoinColumn({ name: 'constraint_set_id' })
  constraintSet!: ConstraintSet;
}
